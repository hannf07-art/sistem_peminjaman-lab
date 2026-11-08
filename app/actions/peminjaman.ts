'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/* ---------- Tipe hasil ---------- */
export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

/* ---------- Konstanta & helper ---------- */
const TIMEZONE = 'Asia/Jakarta';
const JAM_BUKA = '06:00';
const JAM_TUTUP = '17:00';

// Tanggal hari ini (YYYY-MM-DD) menurut WIB, bukan zona waktu server
function hariIniWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
}

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

  if (profilError || profil?.role !== 'Kaprodi') {
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