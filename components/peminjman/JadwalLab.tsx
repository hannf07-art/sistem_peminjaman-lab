'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  batalkanMkWajibMahasiswa,
  batalkanPeminjamanKaprodi,
} from '@/app/actions/peminjaman';
import {
  GlassCard,
  Modal,
  Spinner,
  StatusBadge,
  dangerButtonCls,
  inputCls,
  labelCls,
  secondaryButtonCls,
  type ToastState,
} from '@/components/auth-ui';
import {
  JAM_BUKA_MENIT,
  JAM_TUTUP_MENIT,
  fmtJam,
  labelTanggalID,
  toMin,
  type JadwalItem,
  type Saya,
} from '@/lib/jadwal';

const TOTAL = JAM_TUTUP_MENIT - JAM_BUKA_MENIT;
const TICKS = Array.from({ length: 12 }, (_, i) => 6 + i); // 06..17
const pct = (min: number) => Math.min(100, Math.max(0, ((min - JAM_BUKA_MENIT) / TOTAL) * 100));

function hitungKosong(items: JadwalItem[]): [number, number][] {
  const sorted = items
    .map((b) => [toMin(b.jam_mulai), toMin(b.jam_selesai)] as const)
    .sort((a, b) => a[0] - b[0]);
  const free: [number, number][] = [];
  let cursor = JAM_BUKA_MENIT;
  for (const [s, e] of sorted) {
    if (s > cursor && cursor < JAM_TUTUP_MENIT) free.push([cursor, Math.min(s, JAM_TUTUP_MENIT)]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < JAM_TUTUP_MENIT) free.push([cursor, JAM_TUTUP_MENIT]);
  return free;
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{nilai}</dd>
    </div>
  );
}

type Props = {
  judul: string;
  subjudul: string;
  aksiHeader?: React.ReactNode;
  bookings: JadwalItem[];
  loading: boolean;
  error: string | null;
  tanggal: string; // YYYY-MM-DD yang sedang ditampilkan
  hariIni: string; // dari server
  peran: 'mahasiswa' | 'kaprodi';
  saya: Saya;
  rentangPilihan?: { start: number; end: number; bentrok: boolean } | null;
  onPilihRentang?: (mulai: string, selesai: string) => void;
  onBerubah: () => void; // refetch setelah pembatalan
  notify: (t: ToastState) => void;
};

export function JadwalLab({
  judul,
  subjudul,
  aksiHeader,
  bookings,
  loading,
  error,
  tanggal,
  hariIni,
  peran,
  saya,
  rentangPilihan,
  onPilihRentang,
  onBerubah,
  notify,
}: Props) {
  const [dipilihId, setDipilihId] = useState<string | null>(null);
  const [mode, setMode] = useState<'detail' | 'konfirmasi'>('detail');
  const [alasanBatal, setAlasanBatal] = useState('');
  const [nowMin, setNowMin] = useState<number | null>(null);
  const [memproses, startTransition] = useTransition();

  // Penanda "sekarang": Date hanya dipakai di dalam effect (client saja)
  useEffect(() => {
    const hitung = () => {
      const [h, m] = new Date()
        .toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        })
        .split(':');
      setNowMin(Number(h) * 60 + Number(m));
    };
    hitung();
    const t = setInterval(hitung, 60_000);
    return () => clearInterval(t);
  }, []);

  const item = useMemo(() => bookings.find((b) => b.id === dipilihId) ?? null, [bookings, dipilihId]);
  const jamKosong = useMemo(() => hitungKosong(bookings), [bookings]);

  const mk = item?.jenis === 'mk_wajib';
  const belumLewat = tanggal >= hariIni;

  // Syarat E: tombol HANYA muncul bila ketiganya terpenuhi (server memeriksa ulang)
  const bolehDelegasi =
    !!item &&
    peran === 'mahasiswa' &&
    mk &&
    item.role_peminjam === 'kaprodi' &&
    !!saya.prodi &&
    saya.prodi === item.prodi &&
    saya.angkatan !== null &&
    saya.angkatan === item.angkatan_target &&
    belumLewat;

  const bolehKaprodi = !!item && peran === 'kaprodi' && belumLewat;

  function tutup() {
    setDipilihId(null);
    setMode('detail');
    setAlasanBatal('');
  }

  function eksekusiBatal() {
    if (!item) return;
    startTransition(async () => {
      const res =
        peran === 'kaprodi'
          ? await batalkanPeminjamanKaprodi({ peminjamanId: item.id, alasan: alasanBatal })
          : await batalkanMkWajibMahasiswa({ peminjamanId: item.id });

      if (res.success) {
        notify({ type: 'success', message: 'Jadwal berhasil dibatalkan' });
        tutup();
        onBerubah();
      } else {
        notify({ type: 'error', message: res.error });
      }
    });
  }

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{judul}</h2>
          <p className="text-sm text-slate-500">{subjudul}</p>
        </div>
        {aksiHeader}
      </div>

      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <Legend color="bg-emerald-100 ring-1 ring-emerald-200" label="Kosong" />
        <Legend color="bg-slate-600" label="Dipinjam" />
        <Legend color="bg-teal-700" label="MK Wajib" />
        <Legend color="border-2 border-dashed border-emerald-500 bg-emerald-300/40" label="Pilihan Anda" />
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
          {error}
        </p>
      )}

      {/* ---------- Timeline ---------- */}
      <div>
        <div
          className={`relative h-16 overflow-hidden rounded-xl bg-emerald-50 ring-1 ring-emerald-100 sm:h-20 ${
            loading ? 'animate-pulse' : ''
          }`}
        >
          {TICKS.map((h) => (
            <div
              key={h}
              className="absolute inset-y-0 border-l border-emerald-100"
              style={{ left: `${pct(h * 60)}%` }}
            />
          ))}

          {!loading &&
            bookings.map((b) => {
              const s = toMin(b.jam_mulai);
              const e = toMin(b.jam_selesai);
              const isMk = b.jenis === 'mk_wajib';
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setDipilihId(b.id)}
                  title={`${fmtJam(s)}–${fmtJam(e)} · ${b.nama_peminjam} (klik untuk detail)`}
                  className={`absolute inset-y-1.5 flex items-center justify-center overflow-hidden rounded-lg px-1 text-[10px] font-semibold text-white shadow-sm outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 sm:text-xs ${
                    isMk ? 'bg-teal-700' : 'bg-slate-600'
                  }`}
                  style={{ left: `${pct(s)}%`, width: `${pct(e) - pct(s)}%` }}
                >
                  <span className="truncate">
                    {fmtJam(s)}–{fmtJam(e)}
                  </span>
                </button>
              );
            })}

          {rentangPilihan && (
            <div
              className={`pointer-events-none absolute inset-y-0 border-2 border-dashed ${
                rentangPilihan.bentrok
                  ? 'border-rose-500 bg-rose-400/30'
                  : 'border-emerald-500 bg-emerald-400/30'
              }`}
              style={{
                left: `${pct(rentangPilihan.start)}%`,
                width: `${pct(rentangPilihan.end) - pct(rentangPilihan.start)}%`,
              }}
            />
          )}

          {nowMin !== null && tanggal === hariIni && nowMin >= JAM_BUKA_MENIT && nowMin <= JAM_TUTUP_MENIT && (
            <div
              title={`Sekarang ${fmtJam(nowMin)}`}
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-slate-800"
              style={{ left: `${pct(nowMin)}%` }}
            />
          )}
        </div>

        <div className="relative mt-1.5 h-5">
          {TICKS.map((h, i) => (
            <span
              key={h}
              className={`absolute text-[10px] text-slate-500 sm:text-xs ${
                h % 2 === 0 ? '' : 'hidden sm:block'
              } ${i === 0 ? '' : i === TICKS.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`}
              style={{ left: `${pct(h * 60)}%` }}
            >
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>
      </div>

      {/* ---------- Jam kosong ---------- */}
      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Jam kosong</h3>
        {loading ? (
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-100" />
        ) : jamKosong.length === 0 ? (
          <p className="text-sm text-slate-500">Tidak ada jam kosong.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {jamKosong.map(([s, e]) =>
              onPilihRentang ? (
                <button
                  key={`${s}-${e}`}
                  type="button"
                  onClick={() => onPilihRentang(fmtJam(s), fmtJam(e))}
                  title="Klik untuk mengisi form dengan rentang ini"
                  className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 transition hover:bg-emerald-200"
                >
                  {fmtJam(s)} – {fmtJam(e)}
                </button>
              ) : (
                <span
                  key={`${s}-${e}`}
                  className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
                >
                  {fmtJam(s)} – {fmtJam(e)}
                </span>
              )
            )}
          </div>
        )}
      </div>

      {/* ---------- Daftar terisi (klik = detail) ---------- */}
      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Jadwal terisi</h3>
        {loading ? (
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          </div>
        ) : bookings.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada jadwal, lab kosong sepanjang hari.</p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white/70 ring-1 ring-slate-200/70">
            {bookings.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setDipilihId(b.id)}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-sm transition hover:bg-emerald-50/60"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">
                      {fmtJam(toMin(b.jam_mulai))} – {fmtJam(toMin(b.jam_selesai))}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {b.nama_peminjam} · {b.alasan || 'Tanpa keterangan'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    <StatusBadge tone="success">Disetujui</StatusBadge>
                    {b.jenis === 'mk_wajib' && <StatusBadge tone="info">MK Wajib</StatusBadge>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------- Modal detail ---------- */}
      <Modal open={!!item} onClose={tutup} title="Detail Jadwal">
        {item && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="success">Disetujui</StatusBadge>
              {mk && <StatusBadge tone="info">MK Wajib</StatusBadge>}
            </div>

            <dl className="divide-y divide-slate-100 rounded-xl bg-slate-50/80 px-4 text-sm ring-1 ring-slate-200/70">
              <Baris label="Nama Peminjam" nilai={item.nama_peminjam} />
              <Baris label="Prodi" nilai={item.prodi ?? '-'} />
              <Baris
                label={mk ? 'Target Angkatan' : 'Angkatan'}
                nilai={String((mk ? item.angkatan_target : item.angkatan) ?? '-')}
              />
              <Baris label="Tanggal" nilai={labelTanggalID(tanggal)} />
              <Baris
                label="Jam Pinjam"
                nilai={`${fmtJam(toMin(item.jam_mulai))} – ${fmtJam(toMin(item.jam_selesai))}`}
              />
              <Baris label={mk ? 'Mata Kuliah / Dosen' : 'Keperluan'} nilai={item.alasan || '-'} />
            </dl>

            {/* Tombol batal (Kaprodi: semua slot; Mahasiswa: hanya bila eligible) */}
            {mode === 'detail' && (bolehKaprodi || bolehDelegasi) && (
              <button
                type="button"
                onClick={() => setMode('konfirmasi')}
                className={`${dangerButtonCls} w-full`}
              >
                {peran === 'kaprodi'
                  ? 'Batalkan Jadwal (Otoritas Kaprodi)'
                  : 'Batalkan Jadwal Ini (Dosen Berhalangan)'}
              </button>
            )}

            {peran === 'mahasiswa' && mk && !bolehDelegasi && (
              <p className="text-xs text-slate-500">
                Jadwal MK Wajib ini hanya dapat dibatalkan oleh mahasiswa {item.prodi ?? '-'} angkatan{' '}
                {item.angkatan_target ?? '-'}.
              </p>
            )}

            {mode === 'konfirmasi' && (
              <div className="space-y-3 rounded-xl bg-rose-50 p-4 ring-1 ring-rose-200">
                <p className="text-sm font-medium text-rose-800">
                  {peran === 'kaprodi'
                    ? 'Batalkan jadwal ini? Tindakan ini tidak dapat dipulihkan.'
                    : 'Pastikan dosen memang berhalangan. Slot akan kosong kembali dan tidak dapat dipulihkan.'}
                </p>

                {peran === 'kaprodi' && (
                  <div>
                    <label htmlFor="alasanBatal" className={labelCls}>
                      Alasan pembatalan
                    </label>
                    <textarea
                      id="alasanBatal"
                      rows={2}
                      maxLength={300}
                      value={alasanBatal}
                      onChange={(e) => setAlasanBatal(e.target.value)}
                      placeholder="Contoh: kegiatan mendesak / perbaikan fasilitas"
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('detail')}
                    disabled={memproses}
                    className={secondaryButtonCls}
                  >
                    Kembali
                  </button>
                  <button
                    type="button"
                    onClick={eksekusiBatal}
                    disabled={memproses || (peran === 'kaprodi' && alasanBatal.trim().length < 3)}
                    className={`${dangerButtonCls} flex-1`}
                  >
                    {memproses && <Spinner />}
                    {memproses ? 'Membatalkan...' : 'Ya, Batalkan'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </GlassCard>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${color}`} />
      {label}
    </span>
  );
}