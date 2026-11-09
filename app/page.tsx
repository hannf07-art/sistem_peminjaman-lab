'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { register } from '@/app/actions/auth';
import { DAFTAR_PRODI } from '@/lib/prodi';
import {
  Alert,
  AuthShell,
  Modal,
  PasswordInput,
  Spinner,
  buttonCls,
  inputCls,
  labelCls,
} from '@/components/auth-ui';

type Jenis = 'mahasiswa' | 'kaprodi';

const OPSI: { value: Jenis; label: string }[] = [
  { value: 'mahasiswa', label: 'Daftar sebagai Mahasiswa' },
  { value: 'kaprodi', label: 'Daftar sebagai Kaprodi/Dosen' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [jenis, setJenis] = useState<Jenis>('mahasiswa');
  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState<{ perluVerifikasiEmail: boolean } | null>(null);
  const [loading, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const password = String(fd.get('password') ?? '');
    if (password !== String(fd.get('konfirmasi') ?? '')) {
      setError('Konfirmasi password tidak sama');
      return;
    }

    startTransition(async () => {
      const res = await register({
        daftarSebagai: jenis,
        namaLengkap: String(fd.get('namaLengkap') ?? ''),
        email: String(fd.get('email') ?? ''),
        prodi: String(fd.get('prodi') ?? ''),
        angkatan: jenis === 'mahasiswa' ? String(fd.get('angkatan') ?? '') : null,
        password,
      });

      if ('error' in res) setError(res.error);
      else setSukses({ perluVerifikasiEmail: res.perluVerifikasiEmail });
    });
  }

  return (
    <>
      <AuthShell
        title="Daftar Akun"
        subtitle="Akun aktif setelah disetujui admin."
        footer={
          <>
            Sudah punya akun?{' '}
            <Link href="/login" className="font-semibold text-emerald-700 hover:text-emerald-800">
              Masuk
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-5">
          {/* Pilihan jenis pendaftaran */}
          <div
            role="radiogroup"
            aria-label="Jenis pendaftaran"
            className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
          >
            {OPSI.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={jenis === o.value}
                onClick={() => setJenis(o.value)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                  jenis === o.value
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {error && <Alert type="error">{error}</Alert>}

          <div>
            <label htmlFor="namaLengkap" className={labelCls}>
              Nama Lengkap
            </label>
            <input
              id="namaLengkap"
              name="namaLengkap"
              type="text"
              required
              minLength={3}
              maxLength={100}
              autoComplete="name"
              placeholder="Nama sesuai identitas"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="email" className={labelCls}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="nama@email.com"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="prodi" className={labelCls}>
              Program Studi
            </label>
            <select id="prodi" name="prodi" required defaultValue="" className={inputCls}>
              <option value="" disabled>
                Pilih program studi
              </option>
              {DAFTAR_PRODI.map((f) => (
                <optgroup key={f.fakultas} label={f.fakultas}>
                  {f.prodi.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Angkatan: hanya untuk Mahasiswa */}
          {jenis === 'mahasiswa' && (
            <div>
              <label htmlFor="angkatan" className={labelCls}>
                Angkatan
              </label>
              <input
                id="angkatan"
                name="angkatan"
                type="number"
                inputMode="numeric"
                required
                min={2000}
                placeholder="Contoh: 2023"
                className={inputCls}
              />
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="password" className={labelCls}>
                Password
              </label>
              <PasswordInput
                id="password"
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Min. 8 karakter"
              />
            </div>
            <div>
              <label htmlFor="konfirmasi" className={labelCls}>
                Konfirmasi Password
              </label>
              <PasswordInput
                id="konfirmasi"
                name="konfirmasi"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Ulangi password"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className={buttonCls}>
            {loading && <Spinner />}
            {loading ? 'Mendaftarkan...' : 'Daftar'}
          </button>
        </form>
      </AuthShell>

      {/* Popup setelah berhasil daftar */}
      <Modal open={!!sukses} onClose={() => router.push('/login')} title="Pendaftaran Berhasil">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
              ✓
            </div>
          </div>
          <p className="text-center text-base font-semibold text-slate-900">Akunmu sudah terdaftar!</p>
          {sukses?.perluVerifikasiEmail && (
            <p className="text-center text-sm text-slate-600">
              Silakan cek email (termasuk folder spam) untuk konfirmasi akun.
            </p>
          )}
          <Alert type="warning">
            Setelah itu, akun masih perlu disetujui admin sebelum bisa digunakan untuk masuk.
          </Alert>
          <Link href="/login" className={buttonCls}>
            Ke Halaman Masuk
          </Link>
        </div>
      </Modal>
    </>
  );
}