import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hariIniWIB } from '@/lib/waktu-server';
import { AppShell } from '@/components/peminjaman/AppShell';
import DashboardMahasiswa from '@/components/peminjaman/DashboardMahasiswa';
import DashboardKaprodi from '@/components/peminjaman/DashboardKaprodi';

export const instant = false;

export default async function PeminjamanPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profil } = await supabase
    .from('users')
    .select('nama_lengkap, role, prodi, angkatan')
    .eq('id', user.id)
    .single();

  if (!profil || !['mahasiswa', 'kaprodi'].includes(profil.role)) {
    redirect('/login?status=pending');
  }

  const { data: labs } = await supabase.from('labs').select('id, nama_lab').order('nama_lab');

  // Semua nilai "waktu" dihitung di server lalu dikirim sebagai props
  const hariIni = hariIniWIB(); // YYYY-MM-DD (WIB)
  const tahunIni = Number(hariIni.slice(0, 4));

  const saya = { id: user.id, prodi: profil.prodi, angkatan: profil.angkatan };
  const role = profil.role as 'mahasiswa' | 'kaprodi';

  return (
    <AppShell nama={profil.nama_lengkap} role={role}>
      {role === 'kaprodi' ? (
        <DashboardKaprodi labs={labs ?? []} hariIni={hariIni} tahunIni={tahunIni} saya={saya} />
      ) : (
        <DashboardMahasiswa labs={labs ?? []} hariIni={hariIni} saya={saya} />
      )}
    </AppShell>
  );
}