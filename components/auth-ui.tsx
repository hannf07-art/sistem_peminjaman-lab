'use client';

import { useState } from 'react';

export const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';

export const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm ' +
  'outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 ' +
  'disabled:bg-slate-100';

export const buttonCls =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold ' +
  'text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold text-white shadow-sm">
            U
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Laboratorium UNISA Palembang
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          {children}
        </div>

        {footer && <p className="mt-5 text-center text-sm text-slate-600">{footer}</p>}
      </div>
    </main>
  );
}

export function Alert({
  type,
  children,
}: {
  type: 'error' | 'warning' | 'success';
  children: React.ReactNode;
}) {
  const styles = {
    error: 'bg-rose-50 text-rose-700 ring-rose-200',
    warning: 'bg-amber-50 text-amber-800 ring-amber-200',
    success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  }[type];

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`rounded-xl px-3.5 py-2.5 text-sm ring-1 ${styles}`}
    >
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
    </svg>
  );
}

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${inputCls} pr-16`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
        className="absolute inset-y-0 right-0 px-3.5 text-xs font-medium text-slate-500 hover:text-indigo-600"
      >
        {show ? 'Tutup' : 'Lihat'}
      </button>
    </div>
  );
}