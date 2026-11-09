'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SEMUA_PRODI } from '@/lib/prodi';

const ROLE_DIIZINKAN = ['mahasiswa', 'kaprodi'];

function petakanErrorAuth(error: { code?: string; message: string }): string {
  if (error.message?.includes('Invalid login credentials')) return 'Email atau password salah';
  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return 'Email sudah terdaftar';
    case 'weak_password':
      return 'Password terlalu lemah, gunakan kombinasi huruf dan angka yang lebih panjang';
    case 'email_address_invalid':
      return 'Alamat email tidak valid';
    case 'invalid_credentials':
      return 'Email atau password salah';
    case 'email_not_confirmed':
      return 'Email belum diverifikasi. Cek kotak masuk (atau folder spam) Anda';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi';
    default:
      console.error('[auth] error:', error);
      return 'Terjadi kesalahan pada server, silakan coba lagi';
  }
}

/* ---------- Skema ---------- */
const registerSchema = z.object({
  daftarSebagai: z.enum(['mahasiswa', 'kaprodi']),
  namaLengkap: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter').max(100),
  email: z.string().trim().toLowerCase().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter').max(72, 'Password terlalu panjang'),
  prodi: z.string().refine((v) => SEMUA_PRODI.includes(v), 'Program studi tidak valid'),
  angkatan: z.union([z.string(), z.number()]).nullish(), // divalidasi manual sesuai jenis
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export type RegisterInput = {
  daftarSebagai: 'mahasiswa' | 'kaprodi';
  namaLengkap: string;
  email: string;
  password: string;
  prodi: string;
  angkatan?: string | number | null;
};

/* =========================================================
 * register
 * ========================================================= */
export async function register(
  input: RegisterInput
): Promise<{ error: string } | { success: true; perluVerifikasiEmail: boolean }> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { daftarSebagai, namaLengkap, email, password, prodi } = parsed.data;

  // Mahasiswa: angkatan wajib. Kaprodi/Dosen: angkatan diabaikan (null).
  let angkatan: number | null = null;
  if (daftarSebagai === 'mahasiswa') {
    const nilai = Number(parsed.data.angkatan);
    if (!Number.isInteger(nilai) || nilai < 2000 || nilai > new Date().getFullYear()) {
      return { error: 'Angkatan wajib diisi dengan tahun yang valid' };
    }
    angkatan = nilai;
  }

  const supabase = await createClient();

  // Metadata ditangkap trigger handle_new_user(). Role tetap 'pending'.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nama_lengkap: namaLengkap,
        prodi,
        angkatan,
        daftar_sebagai: daftarSebagai,
      },
    },
  });

  if (error) {
    return { error: petakanErrorAuth(error) };
  }

  // Confirm email aktif + email sudah terdaftar -> user palsu tanpa identities
  if (data.user && data.user.identities?.length === 0) {
    return { error: 'Email sudah terdaftar' };
  }

  // Confirm email dimatikan -> signUp langsung membuat sesi; akun masih 'pending'
  const perluVerifikasiEmail = !data.session;
  if (data.session) {
    await supabase.auth.signOut();
  }

  return { success: true, perluVerifikasiEmail };
}

/* =========================================================
 * login
 * ========================================================= */
export async function login(input: { email: string; password: string }): Promise<{ error: string }> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { error: petakanErrorAuth(error ?? { message: 'unknown' }) };
  }

  const { data: profil, error: profilError } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (profilError || !profil) {
    await supabase.auth.signOut();
    return { error: 'Profil akun tidak ditemukan, hubungi admin' };
  }

  if (!ROLE_DIIZINKAN.includes(profil.role)) {
    await supabase.auth.signOut();
    return {
      error: 'Akun Anda masih menunggu persetujuan admin. Silakan coba lagi setelah disetujui.',
    };
  }

  redirect('/peminjaman'); // jangan dibungkus try/catch
}

/* =========================================================
 * logout
 * ========================================================= */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}