'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/* =========================================================
 * Class bersama
 * ========================================================= */
export const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';

export const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm ' +
  'outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ' +
  'disabled:bg-slate-100';

export const buttonCls =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold ' +
  'text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 focus:outline-none ' +
  'focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-50';

export const secondaryButtonCls =
  'flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm ' +
  'font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 ' +
  'focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-50';

export const dangerButtonCls =
  'flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white ' +
  'shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-200 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

/* =========================================================
 * Background faded green glow
 * ========================================================= */
export function GlowBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-slate-50">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[26rem] w-[60rem] max-w-none -translate-x-1/2 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-teal-100/50 blur-3xl" />
        <div className="absolute -left-32 top-1/3 h-72 w-72 rounded-full bg-emerald-100/40 blur-3xl" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* =========================================================
 * Glassmorphism card
 * ========================================================= */
export function GlassCard({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/50 bg-white/80 shadow-lg shadow-slate-900/5 ring-1 ring-slate-900/5 backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

/* =========================================================
 * Logo header (horizontal, sudah memuat nama kampus)
 * ========================================================= */
export function Logo() {
  return (
    <Image
      alt="Logo UNISA"
      className="h-auto w-40 object-contain md:w-48"
      height={60}
      priority
      src="/logo.png"
      width={200}
    />
  );
}

/* =========================================================
 * Badge status
 * ========================================================= */
const TONES = {
  success: { box: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
  warning: { box: 'bg-amber-50 text-amber-700 ring-amber-600/20', dot: 'bg-amber-500' },
  danger: { box: 'bg-rose-50 text-rose-700 ring-rose-600/20', dot: 'bg-rose-500' },
  info: { box: 'bg-teal-50 text-teal-700 ring-teal-600/20', dot: 'bg-teal-500' },
  neutral: { box: 'bg-slate-100 text-slate-600 ring-slate-500/20', dot: 'bg-slate-400' },
} as const;

export type Tone = keyof typeof TONES;

export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${t.box}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {children}
    </span>
  );
}

/* =========================================================
 * Alert, Spinner, Password
 * ========================================================= */
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
        className="absolute inset-y-0 right-0 px-3.5 text-xs font-medium text-slate-500 hover:text-emerald-700"
      >
        {show ? 'Tutup' : 'Lihat'}
      </button>
    </div>
  );
}

/* =========================================================
 * Portal, Modal, Toast
 * (Portal wajib: backdrop-blur pada GlassCard membuat elemen "fixed"
 *  di dalamnya terpotong oleh card, bukan menutupi layar)
 * ========================================================= */
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/50 bg-white/95 p-5 shadow-2xl sm:p-6"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      </div>
    </Portal>
  );
}

export type ToastState = { type: 'success' | 'error'; message: string } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return { toast, notify: setToast, closeToast: () => setToast(null) };
}

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;
  return (
    <Portal>
      <div aria-live="assertive" className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex justify-end">
        <div
          role="alert"
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm text-white shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/25 text-xs font-bold">
            {toast.type === 'success' ? '✓' : '!'}
          </span>
          <p className="flex-1 font-medium">{toast.message}</p>
          <button onClick={onClose} aria-label="Tutup notifikasi" className="text-white/80 hover:text-white">
            ✕
          </button>
        </div>
      </div>
    </Portal>
  );
}

/* =========================================================
 * Layout halaman login & register
 * ========================================================= */
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
    <GlowBackground>
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <Image
              alt="Logo UNISA"
              className="mx-auto object-contain drop-shadow-md"
              height={70}
              priority
              src="/unisalogo.png"
              width={70}
            />
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>

          <GlassCard className="p-5 sm:p-7">{children}</GlassCard>

          {footer && <p className="mt-5 text-center text-sm text-slate-600">{footer}</p>}
        </div>
      </div>
    </GlowBackground>
  );
}