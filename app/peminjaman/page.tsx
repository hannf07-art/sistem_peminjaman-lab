'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createPeminjaman } from '@/app/actions/peminjaman';

/* =========================================================
 * Konstanta & helper
 * ========================================================= */
const TZ = 'Asia/Jakarta';
const JAM_BUKA = 6 * 60; // 06:00 (menit)
const JAM_TUTUP = 17 * 60; // 17:00 (menit)
const TOTAL = JAM_TUTUP - JAM_BUKA;
const JAM_TICKS = Array.from({ length: 12 }, (_, i) => 6 + i); // 6..17

type Lab = { id: string; nama_lab: string };
type Booking = {
  id: string;
  jam_mulai: string; // "HH:MM:SS"
  jam_selesai: string;
  alasan: string | null;
};
type ToastState = { type: 'success' | 'error'; message: string } | null;

const toMin = (t: string) => {
  const [h, m] = t.split(':');
  return Number(h) * 60 + Number(m);
};
const fmt = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const pct = (min: number) =>
  Math.min(100, Math.max(0, ((min - JAM_BUKA) / TOTAL) * 100));

const todayWIB = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); // YYYY-MM-DD

const nowMinutesWIB = () => {
  const [h, m] = new Date()
    .toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .split(':');
  return Number(h) * 60 + Number(m);
};

function hitungKosong(bookings: Booking[]): [number, number][] {
  const sorted = bookings
    .map((b) => [toMin(b.jam_mulai), toMin(b.jam_selesai)] as const)
    .sort((a, b) => a[0] - b[0]);
  const free: [number, number][] = [];
  let cursor = JAM_BUKA;
  for (const [s, e] of sorted) {
    if (s > cursor && cursor < JAM_TUTUP) free.push([cursor, Math.min(s, JAM_TUTUP)]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < JAM_TUTUP) free.push([cursor, JAM_TUTUP]);
  return free;
}

/* Kelas Tailwind yang dipakai ulang */
const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';
const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm ' +
  'outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100';

/* =========================================================
 * Komponen utama
 * ========================================================= */
export default function PeminjamanPage() {
  const supabase = useMemo(() => createClient(), []);

  const [today, setToday] = useState('');
  const [nowMin, setNowMin] = useState<number | null>(null);

  const [labs, setLabs] = useState<Lab[]>([]);
  const [labId, setLabId] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [jamMulai, setJamMulai] = useState('');
  const [jamSelesai, setJamSelesai] = useState('');
  const [alasan, setAlasan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const reqRef = useRef(0);

  /* ---------- Tanggal & jam sekarang (WIB), dihitung di client ---------- */
  useEffect(() => {
    setToday(todayWIB());
    setNowMin(nowMinutesWIB());
    const t = setInterval(() => {
      setToday(todayWIB());
      setNowMin(nowMinutesWIB());
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  /* ---------- Ambil daftar lab ---------- */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('labs')
        .select('id, nama_lab')
        .order('nama_lab');
      if (error) {
        setFetchError('Gagal memuat daftar laboratorium');
        setLoadingBookings(false);
        return;
      }
      setLabs(data ?? []);
      if (data?.length) setLabId(data[0].id);
      else setLoadingBookings(false);
    })();
  }, [supabase]);

  /* ---------- Ambil jadwal hari ini untuk lab terpilih ---------- */
  const fetchBookings = useCallback(async () => {
    if (!labId || !today) return;
    const myReq = ++reqRef.current;
    const { data, error } = await supabase
      .from('peminjaman')
      .select('id, jam_mulai, jam_selesai, alasan')
      .eq('lab_id', labId)
      .eq('tanggal', today)
      .eq('status', 'aktif')
      .order('jam_mulai');

    if (myReq !== reqRef.current) return; // abaikan respons usang
    if (error) setFetchError('Gagal memuat jadwal lab');
    else {
      setFetchError(null);
      setBookings(data ?? []);
    }
    setLoadingBookings(false);
  }, [supabase, labId, today]);

  /* ---------- Fetch + Realtime (jadwal ter-update otomatis) ---------- */
  useEffect(() => {
    if (!labId || !today) return;
    setLoadingBookings(true);
    fetchBookings();

    const channel = supabase
      .channel(`peminjaman-${labId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'peminjaman', filter: `lab_id=eq.${labId}` },
        () => fetchBookings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, labId, today, fetchBookings]);

  /* ---------- Toast auto-hilang ---------- */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- Validasi & turunan data ---------- */
  const start = jamMulai ? toMin(jamMulai) : NaN;
  const end = jamSelesai ? toMin(jamSelesai) : NaN;
  const keduaTerisi = Boolean(jamMulai && jamSelesai);

  let pesanJam: string | null = null;
  if (keduaTerisi) {
    if (end <= start) pesanJam = 'Jam selesai harus setelah jam mulai';
    else if (start < JAM_BUKA || end > JAM_TUTUP)
      pesanJam = 'Jam peminjaman harus antara 06:00 dan 17:00';
  }
  const rentangValid = keduaTerisi && !pesanJam;

  // Peringatan dini di sisi client (server tetap menjadi penentu akhir)
  const bentrok = rentangValid
    ? bookings.find((b) => start < toMin(b.jam_selesai) && end > toMin(b.jam_mulai))
    : undefined;

  const jamKosong = useMemo(() => hitungKosong(bookings), [bookings]);
  const labTerpilih = labs.find((l) => l.id === labId);
  const tanggalLabel = today
    ? new Date(`${today}T00:00:00`).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '...';

  /* ---------- Submit ---------- */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rentangValid || !labId || !today || submitting) return;

    setSubmitting(true);
    try {
      const res = await createPeminjaman({
        labId,
        tanggal: today,
        jamMulai,
        jamSelesai,
        alasan: alasan.trim() || undefined,
      });

      if (res.success) {
        setToast({ type: 'success', message: 'Peminjaman berhasil diajukan!' });
        setJamMulai('');
        setJamSelesai('');
        setAlasan('');
        fetchBookings();
      } else {
        setToast({
          type: 'error',
          message:
            res.error === 'Jadwal bentrok'
              ? 'Jadwal bentrok! Jam tersebut sudah dipakai, pilih jam lain.'
              : res.error,
        });
      }
    } catch {
      setToast({ type: 'error', message: 'Gagal terhubung ke server, coba lagi.' });
    } finally {
      setSubmitting(false);
    }
  }

  /* =========================================================
   * Render
   * ========================================================= */
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Peminjaman Laboratorium
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tanggalLabel} &middot; Lihat jam kosong, lalu ajukan peminjaman untuk hari ini.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* ================= FORM ================= */}
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6 lg:col-span-2">
            <h2 className="mb-5 text-lg font-semibold text-slate-900">Form Peminjaman</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="lab" className={labelCls}>
                  Laboratorium
                </label>
                <select
                  id="lab"
                  value={labId}
                  onChange={(e) => setLabId(e.target.value)}
                  disabled={!labs.length}
                  className={inputCls}
                >
                  {labs.length === 0 && <option>Memuat...</option>}
                  {labs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nama_lab}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className={labelCls}>Tanggal</span>
                <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-700">
                  <span>{tanggalLabel}</span>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    Hari ini
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  Peminjaman hanya dapat diajukan untuk hari ini.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="jamMulai" className={labelCls}>
                    Jam Mulai
                  </label>
                  <input
                    id="jamMulai"
                    type="time"
                    min="06:00"
                    max="17:00"
                    required
                    value={jamMulai}
                    onChange={(e) => setJamMulai(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="jamSelesai" className={labelCls}>
                    Jam Selesai
                  </label>
                  <input
                    id="jamSelesai"
                    type="time"
                    min="06:00"
                    max="17:00"
                    required
                    value={jamSelesai}
                    onChange={(e) => setJamSelesai(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {pesanJam && <p className="-mt-2 text-sm text-rose-600">{pesanJam}</p>}
              {!pesanJam && bentrok && (
                <p className="-mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
                  Bentrok dengan jadwal {fmt(toMin(bentrok.jam_mulai))}–
                  {fmt(toMin(bentrok.jam_selesai))}. Pilih jam lain.
                </p>
              )}

              <div>
                <label htmlFor="alasan" className={labelCls}>
                  Keperluan <span className="font-normal text-slate-400">(opsional)</span>
                </label>
                <textarea
                  id="alasan"
                  rows={3}
                  maxLength={500}
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Contoh: Praktikum jaringan kelompok 3"
                  className={`${inputCls} resize-none`}
                />
              </div>

              <button
                type="submit"
                disabled={!rentangValid || !labId || submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
                  </svg>
                )}
                {submitting ? 'Mengirim...' : 'Ajukan Peminjaman'}
              </button>
            </form>
          </section>

          {/* ================= TIMELINE ================= */}
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6 lg:col-span-3">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Jadwal Hari Ini</h2>
                <p className="text-sm text-slate-500">{labTerpilih?.nama_lab ?? 'Memuat lab...'}</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <Legend color="bg-emerald-200" label="Kosong" />
                <Legend color="bg-rose-500" label="Terisi" />
                <Legend color="bg-indigo-400" label="Pilihan Anda" />
              </div>
            </div>

            {fetchError && (
              <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
                {fetchError}
              </p>
            )}

            {/* Bar timeline */}
            <div>
              <div
                className={`relative h-16 overflow-hidden rounded-xl bg-emerald-50 ring-1 ring-emerald-200 sm:h-20 ${
                  loadingBookings ? 'animate-pulse' : ''
                }`}
              >
                {/* garis jam */}
                {JAM_TICKS.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-y-0 border-l border-emerald-200/80"
                    style={{ left: `${pct(h * 60)}%` }}
                  />
                ))}

                {/* blok ter-booking */}
                {!loadingBookings &&
                  bookings.map((b) => {
                    const s = toMin(b.jam_mulai);
                    const e = toMin(b.jam_selesai);
                    return (
                      <div
                        key={b.id}
                        title={`${fmt(s)} – ${fmt(e)}${b.alasan ? ` · ${b.alasan}` : ''}`}
                        className="absolute inset-y-1.5 flex items-center justify-center overflow-hidden rounded-lg bg-rose-500 px-1 text-[10px] font-semibold text-white shadow-sm sm:text-xs"
                        style={{ left: `${pct(s)}%`, width: `${pct(e) - pct(s)}%` }}
                      >
                        <span className="truncate">
                          {fmt(s)}–{fmt(e)}
                        </span>
                      </div>
                    );
                  })}

                {/* pratinjau pilihan user */}
                {rentangValid && (
                  <div
                    className={`absolute inset-y-0 border-2 border-dashed ${
                      bentrok
                        ? 'border-amber-500 bg-amber-400/30'
                        : 'border-indigo-500 bg-indigo-400/30'
                    }`}
                    style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }}
                  />
                )}

                {/* penanda waktu sekarang */}
                {nowMin !== null && nowMin >= JAM_BUKA && nowMin <= JAM_TUTUP && (
                  <div
                    title={`Sekarang ${fmt(nowMin)}`}
                    className="absolute inset-y-0 w-0.5 bg-slate-800"
                    style={{ left: `${pct(nowMin)}%` }}
                  />
                )}
              </div>

              {/* label jam */}
              <div className="relative mt-1.5 h-5">
                {JAM_TICKS.map((h, i) => (
                  <span
                    key={h}
                    className={`absolute text-[10px] text-slate-500 sm:text-xs ${
                      h % 2 === 0 ? '' : 'hidden sm:block'
                    } ${
                      i === 0
                        ? ''
                        : i === JAM_TICKS.length - 1
                        ? '-translate-x-full'
                        : '-translate-x-1/2'
                    }`}
                    style={{ left: `${pct(h * 60)}%` }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </span>
                ))}
              </div>
            </div>

            {/* Jam kosong */}
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Jam kosong</h3>
              {loadingBookings ? (
                <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-100" />
              ) : jamKosong.length === 0 ? (
                <p className="text-sm text-slate-500">Tidak ada jam kosong hari ini.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {jamKosong.map(([s, e]) => (
                    <button
                      key={`${s}-${e}`}
                      type="button"
                      onClick={() => {
                        setJamMulai(fmt(s));
                        setJamSelesai(fmt(e));
                      }}
                      className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 transition hover:bg-emerald-200"
                      title="Klik untuk mengisi form dengan rentang ini"
                    >
                      {fmt(s)} – {fmt(e)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Daftar terisi */}
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Jadwal terisi</h3>
              {loadingBookings ? (
                <div className="space-y-2">
                  <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                  <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                </div>
              ) : bookings.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Belum ada peminjaman hari ini, lab kosong sepanjang hari.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                  {bookings.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                      <span className="font-medium text-slate-800">
                        {fmt(toMin(b.jam_mulai))} – {fmt(toMin(b.jam_selesai))}
                      </span>
                      <span className="truncate text-slate-500">{b.alasan || 'Tanpa keterangan'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ================= TOAST ================= */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-x-4 top-4 z-50 flex justify-end"
      >
        {toast && (
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
            <button
              onClick={() => setToast(null)}
              aria-label="Tutup notifikasi"
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

/* Komponen kecil untuk legenda */
function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${color}`} />
      {label}
    </span>
  );
}