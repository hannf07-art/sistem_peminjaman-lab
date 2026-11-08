'use client';

import { Suspense, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { login } from '@/app/actions/auth';
import {
  Alert,
  AuthShell,
  PasswordInput,
  Spinner,
  buttonCls,
  inputCls,
  labelCls,
} from '@/components/auth-ui';

function LoginForm() {
  const searchParams = useSearchParams();
  const belumDisetujui = searchParams.get('status') === 'pending';

  const [error, setError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await login({
        email: String(fd.get('email') ?? ''),
        password: String(fd.get('password') ?? ''),
      });
      // Jika sukses, server langsung redirect ke /peminjaman
      if (res?.error) setError(res.error);
    });
  }

  return (
    <AuthShell
      title="Masuk"
      subtitle="Gunakan akun yang sudah disetujui admin"
      footer={
        <>
          Belum punya akun?{' '}
          <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Daftar sebagai Ketua Angkatan/Dosen
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {belumDisetujui && !error && (
          <Alert type="warning">
            Akun Anda belum disetujui atau belum memiliki akses. Hubungi admin, atau masuk dengan
            akun lain.
          </Alert>
        )}
        {error && <Alert type="error">{error}</Alert>}

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
          <label htmlFor="password" className={labelCls}>
            Password
          </label>
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="Masukkan password"
          />
        </div>

        <button type="submit" disabled={loading} className={buttonCls}>
          {loading && <Spinner />}
          {loading ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  // useSearchParams wajib dibungkus Suspense agar build Next.js tidak error
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}