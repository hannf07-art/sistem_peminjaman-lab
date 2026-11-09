'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hariIniWIB } from '@/lib/waktu-server';
import {
  NAMA_HARI,
  MAKS_RENTANG_HARI,
  daftarTanggalBerulang,
  selisihHari,
  tanggalValid,
} from '@/lib/jadwal';

/* ---------- Tipe hasil ---------- */
export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

/* ---------- Konstanta & helper ---------- */
const TIMEZONE = 'Asia/Jakarta';
const JAM_BUKA = '06:00';
const JAM_TUTUP = '17:00';

// Pemetaan error Postgres -> pesan yang ramah
function petakanError(error: { code?: string; message: string }): string {
  if (error.code === 'P0001' && error.message.includes('Jadwal bentrok')) {
    return 'Jadwal bentrok';
  }
  switch (error.code) {
    case '42501': // RLS / bukan Kaprodi
      return 'Anda tidak memiliki akses untuk aksi ini';
    case 'P0002': // peminjaman tidak ditemukan / sudah batal
      return error.message;
    case '23503': // foreign key (lab_id tidak valid)
      return 'Lab tidak ditemukan';
    case '23514': // CHECK constraint jam_selesai > jam_mulai
      return 'Jam selesai harus setelah jam mulai';
    default:
      console.error('[peminjaman] DB error:', error);
      return 'Terjadi kesalahan pada server, silakan coba lagi';
  }
}

/* ---------- Skema validasi ---------- */
const jamSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam harus HH:MM');

const createSchema = z.object({
  labId: z.string().uuid('Lab tidak valid'),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  jamMulai: jamSchema,
  jamSelesai: jamSchema,
  alasan: z.string().trim().max(500).optional(),
});

const overrideSchema = z
  .object({
    peminjamanId: z.string().uuid('ID peminjaman tidak valid'),
    alasan: z.string().trim().min(3, 'Alasan wajib diisi').max(500),
    jamMulai: jamSchema.optional(),
    jamSelesai: jamSchema.optional(),
  })
  .refine((d) => Boolean(d.jamMulai) === Boolean(d.jamSelesai), {
    message: 'Isi jam mulai dan jam selesai keduanya, atau kosongkan keduanya',
  })
  .refine((d) => !d.jamMulai || !d.jamSelesai || d.jamSelesai > d.jamMulai, {
    message: 'Jam selesai harus setelah jam mulai',
  });

export type CreatePeminjamanInput = z.infer<typeof createSchema>;
export type OverridePeminjamanInput = z.infer<typeof overrideSchema>;

/* =========================================================
 * 1. createPeminjaman  (Mahasiswa)
 * ========================================================= */
export async function createPeminjaman(
  input: CreatePeminjamanInput
): Promise<ActionResult> {
  // a. Validasi bentuk data
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { labId, tanggal, jamMulai, jamSelesai, alasan } = parsed.data;

  // b. Aturan bisnis: hanya H-0
  if (tanggal !== hariIniWIB()) {
    return { success: false, error: 'Peminjaman hanya dapat diajukan untuk hari ini' };
  }

  // c. Aturan bisnis: jam 06:00 - 17:00
  if (jamMulai < JAM_BUKA || jamSelesai > JAM_TUTUP) {
    return {
      success: false,
      error: `Jam peminjaman harus antara ${JAM_BUKA} dan ${JAM_TUTUP}`,
    };
  }
  if (jamSelesai <= jamMulai) {
    return { success: false, error: 'Jam selesai harus setelah jam mulai' };
  }

  // d. Autentikasi: user_id diambil dari sesi, BUKAN dari input client
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return { success: false, error: 'Anda harus login terlebih dahulu' };
  }

  // Hanya akun yang sudah disetujui admin
  const { data: profil } = await supabase
  .from('users')
  .select('role')
  .eq('id', auth.user.id)
  .single();

  if (!profil || !['mahasiswa', 'kaprodi'].includes(profil.role)) {
  return { success: false, error: 'Akun Anda belum disetujui admin' };
  }
  // e. Kirim ke Supabase (trigger bentrok berjalan di sini)
  const { data, error } = await supabase
    .from('peminjaman')
    .insert({
      user_id: auth.user.id,
      lab_id: labId,
      tanggal,
      jam_mulai: jamMulai,
      jam_selesai: jamSelesai,
      status: 'aktif',
      alasan: alasan || null,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: petakanError(error) };
  }

  revalidatePath('/peminjaman');
  return { success: true, data };
}

/* =========================================================
 * 2. overridePeminjamanKaprodi  (khusus Kaprodi)
 * ========================================================= */
export async function overridePeminjamanKaprodi(
  input: OverridePeminjamanInput
): Promise<ActionResult> {
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { peminjamanId, alasan, jamMulai, jamSelesai } = parsed.data;

  const supabase = await createClient();

  // Autentikasi
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return { success: false, error: 'Anda harus login terlebih dahulu' };
  }

  // Cek role di server (fail-fast; RPC & RLS tetap memeriksa ulang)
  const { data: profil, error: profilError } = await supabase
    .from('users')
    .select('role')
    .eq('id', auth.user.id)
    .single();

  if (profilError || profil?.role !== 'kaprodi') {
    return { success: false, error: 'Hanya Kaprodi yang dapat melakukan override' };
  }

  // Batalkan + insert dalam SATU transaksi lewat RPC
  const { data, error } = await supabase.rpc('override_peminjaman_kaprodi', {
    p_peminjaman_id: peminjamanId,
    p_alasan: alasan,
    p_jam_mulai: jamMulai ?? null,
    p_jam_selesai: jamSelesai ?? null,
  });

  if (error) {
    return { success: false, error: petakanError(error) };
  }

  revalidatePath('/peminjaman');
  return { success: true, data };
}

/* =========================================================
 * Helper: pastikan pemanggil adalah Kaprodi
 * ========================================================= */
type Supabase = Awaited<ReturnType<typeof createClient>>;

async function cekKaprodi(
  supabase: Supabase
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { ok: false, error: 'Anda harus login terlebih dahulu' };

  const { data: profil, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', auth.user.id)
    .single();

  if (error || profil?.role !== 'kaprodi') {
    return { ok: false, error: 'Hanya Kaprodi yang dapat melakukan aksi ini' };
  }
  return { ok: true, userId: auth.user.id };
}

/* =========================================================
 * 3. createJadwalRutinKaprodi: MK Wajib 1 semester
 * ========================================================= */
const tanggalSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal tidak valid')
  .refine(tanggalValid, 'Tanggal tidak valid');

const jadwalRutinSchema = z
  .object({
    labId: z.string().uuid('Lab tidak valid'),
    hari: z.coerce.number().int().min(1, 'Hari tidak valid').max(6, 'Hari tidak valid'),
    jamMulai: jamSchema,
    jamSelesai: jamSchema,
    tanggalMulai: tanggalSchema,
    tanggalSelesai: tanggalSchema,
    angkatanTarget: z.coerce
      .number()
      .int('Target angkatan tidak valid')
      .min(2000, 'Target angkatan tidak valid')
      .refine((v) => v <= new Date().getFullYear(), 'Target angkatan tidak valid'),
    namaMk: z
      .string()
      .trim()
      .min(3, 'Nama MK / Dosen minimal 3 karakter')
      .max(200, 'Nama MK / Dosen terlalu panjang'),
  })
  .refine((d) => d.jamSelesai > d.jamMulai, { message: 'Jam selesai harus setelah jam mulai' })
  .refine((d) => d.tanggalSelesai >= d.tanggalMulai, {
    message: 'Tanggal selesai harus setelah tanggal mulai',
  });

export type JadwalRutinInput = {
  labId: string;
  hari: number; // 1=Senin ... 6=Sabtu
  jamMulai: string;
  jamSelesai: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  angkatanTarget: number | string;
  namaMk: string;
};

export type RingkasanJadwalRutin = {
  dibuat: number;
  dibatalkan: number;
  dilewati: number;
  totalTanggal: number;
};

export async function createJadwalRutinKaprodi(
  input: JadwalRutinInput
): Promise<ActionResult<RingkasanJadwalRutin>> {
  const parsed = jadwalRutinSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { labId, hari, jamMulai, jamSelesai, tanggalMulai, tanggalSelesai, angkatanTarget, namaMk } =
    parsed.data;

  const supabase = await createClient();
  const cek = await cekKaprodi(supabase);
  if (!cek.ok) return { success: false, error: cek.error };

  // Hitung semua tanggal pada hari terpilih
  if (selisihHari(tanggalMulai, tanggalSelesai) > MAKS_RENTANG_HARI) {
    return { success: false, error: `Rentang tanggal maksimal ${MAKS_RENTANG_HARI} hari` };
  }
  const semua = daftarTanggalBerulang(tanggalMulai, tanggalSelesai, hari);
  if (semua.length === 0) {
    return { success: false, error: `Tidak ada hari ${NAMA_HARI[hari]} pada rentang tanggal tersebut` };
  }

  // Tanggal yang sudah lewat dilewati (riwayat tidak diubah)
  const hariIni = hariIniWIB();
  const tanggalProses = semua.filter((t) => t >= hariIni);
  const dilewati = semua.length - tanggalProses.length;
  if (tanggalProses.length === 0) {
    return { success: false, error: 'Semua tanggal pada rentang tersebut sudah lewat' };
  }

  // Satu transaksi di Postgres: batalkan booking mahasiswa + insert MK Wajib
  const { data, error } = await supabase.rpc('buat_jadwal_rutin_kaprodi', {
    p_lab_id: labId,
    p_tanggal: tanggalProses,
    p_jam_mulai: jamMulai,
    p_jam_selesai: jamSelesai,
    p_alasan: namaMk,
    p_angkatan_target: angkatanTarget,
  });

  if (error) {
    // P0001 dari fungsi ini = pesan bentrok yang sudah ramah (memuat tanggalnya)
    if (error.code === 'P0001') return { success: false, error: error.message };
    return { success: false, error: petakanError(error) };
  }

  const ringkasan = data as { dibuat: number; dibatalkan: number };
  revalidatePath('/peminjaman');
  return {
    success: true,
    data: {
      dibuat: ringkasan.dibuat,
      dibatalkan: ringkasan.dibatalkan,
      dilewati,
      totalTanggal: semua.length,
    },
  };
}

/* =========================================================
 * 4. batalkanPeminjamanKaprodi: cabut paksa (otoritas penuh)
 * ========================================================= */
const batalKaprodiSchema = z.object({
  peminjamanId: z.string().uuid('ID peminjaman tidak valid'),
  alasan: z.string().trim().min(3, 'Alasan pembatalan wajib diisi (min. 3 karakter)').max(300),
});

export async function batalkanPeminjamanKaprodi(input: {
  peminjamanId: string;
  alasan: string;
}): Promise<ActionResult> {
  const parsed = batalKaprodiSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const cek = await cekKaprodi(supabase);
  if (!cek.ok) return { success: false, error: cek.error };

  const { data, error } = await supabase
    .from('peminjaman')
    .update({
      status: 'dibatalkan',
      alasan_batal: `Dibatalkan Kaprodi (urgent): ${parsed.data.alasan}`,
      dibatalkan_oleh: cek.userId,
      dibatalkan_pada: new Date().toISOString(),
    })
    .eq('id', parsed.data.peminjamanId)
    .eq('status', 'aktif')
    .select('id');

  if (error) return { success: false, error: petakanError(error) };
  if (!data || data.length === 0) {
    return { success: false, error: 'Jadwal tidak ditemukan atau sudah dibatalkan' };
  }

  revalidatePath('/peminjaman');
  return { success: true, data: null };
}

/* =========================================================
 * 5. batalkanMkWajibMahasiswa: delegasi (dosen berhalangan)
 *    Semua syarat dicek di fungsi Postgres, bukan di sini.
 * ========================================================= */
export async function batalkanMkWajibMahasiswa(input: {
  peminjamanId: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({ peminjamanId: z.string().uuid('ID peminjaman tidak valid') })
    .safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return { success: false, error: 'Anda harus login terlebih dahulu' };
  }

  const { error } = await supabase.rpc('batalkan_mk_wajib_delegasi', {
    p_peminjaman_id: parsed.data.peminjamanId,
  });

  if (error) {
    // 42501 / P0002 / P0001 di sini berasal dari RAISE di fungsi: pesannya aman ditampilkan
    if (['42501', 'P0002', 'P0001'].includes(error.code ?? '')) {
      return { success: false, error: error.message };
    }
    return { success: false, error: petakanError(error) };
  }

  revalidatePath('/peminjaman');
  return { success: true, data: null };
}