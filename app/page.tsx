'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { register } from '@/app/actions/auth';
import { DAFTAR_PRODI } from '@/lib/prodi';
import {
  Alert,
  AuthShell,
  PasswordInput,
  Spinner,
  buttonCls,
  inputCls,
  labelCls,
} from '@/components/auth-ui';

export default function RegisterPage() {
  const tahunIni = 2026;

  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState<{ perluVerifikasiEmail: boolean } | null>(null);
  const [loading, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const password = String(fd.get('password') ?? '');
    const konfirmasi = String(fd.get('konfirmasi') ?? '');

    if (password !== konfirmasi) {
      setError('Konfirmasi password tidak sama');
      return;
    }

    startTransition(async () => {
      const res = await register({
        namaLengkap: String(fd.get('namaLengkap') ?? ''),
        email: String(fd.get('email') ?? ''),
        prodi: String(fd.get('prodi') ?? ''),
        angkatan: String(fd.get('angkatan') ?? ''),
        password,
      });

      if ('error' in res) setError(res.error);
      else setSukses({ perluVerifikasiEmail: res.perluVerifikasiEmail });
    });
  }

  /* ---------- Tampilan setelah berhasil daftar ---------- */
  if (sukses) {
    return (
      <AuthShell title="Pendaftaran Berhasil" subtitle="Satu langkah lagi sebelum akun aktif">
        <div className="space-y-4">
          <Alert type="success">
            Akun Anda telah dibuat dan <strong>menunggu persetujuan admin</strong>. Anda baru bisa
            masuk setelah akun disetujui.
          </Alert>
          {sukses.perluVerifikasiEmail && (
            <p className="text-sm text-slate-600">
              Kami juga mengirim email verifikasi. Klik tautan di email tersebut (cek folder spam
              jika belum masuk).
            </p>
          )}
          <Link href="/login" className={buttonCls}>
            Ke Halaman Masuk
          </Link>
        </div>
      </AuthShell>
    );
  }

  /* ---------- Form pendaftaran ---------- */
  return (
    <AuthShell
      title="Daftar Akun"
      subtitle="Khusus Ketua Angkatan/Dosen. Akun aktif setelah disetujui admin."
      footer={
        <>
          Sudah punya akun?{' '}
          <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Masuk
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
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
            max={tahunIni}
            placeholder={String(tahunIni)}
            className={inputCls}
          />
        </div>

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
  );
}