'use client';

import { useState } from 'react';
import { createPeminjaman } from '@/app/actions/peminjaman';
import {
  GlassCard,
  Spinner,
  StatusBadge,
  Toast,
  buttonCls,
  inputCls,
  labelCls,
  useToast,
  type Tone,
} from '@/components/auth-ui';
import { JadwalLab } from '@/components/peminjaman/JadwalLab';
import { useJadwalLab } from '@/components/peminjaman/useJadwalLab';
import {
  JAM_BUKA_MENIT,
  JAM_TUTUP_MENIT,
  labelTanggalID,
  toMin,
  type Lab,
  type Saya,
} from '@/lib/jadwal';

export default function DashboardMahasiswa({
  labs,
  hariIni,
  saya,
}: {
  labs: Lab[];
  hariIni: string;
  saya: Saya;
}) {
  const [labId, setLabId] = useState(labs[0]?.id ?? '');
  
  // TAMBAHAN: State untuk memilih tanggal yang ingin dilihat (default ke hari ini)
  const [tanggalLihat, setTanggalLihat] = useState(hariIni);

  const [jamMulai, setJamMulai] = useState('');
  const [jamSelesai, setJamSelesai] = useState('');
  const [alasan, setAlasan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { toast, notify, closeToast } = useToast();
  
  // Memuat jadwal berdasarkan lab dan tanggal yang SEDANG DIPILIH untuk dilihat
  const jadwal = useJadwalLab(labId, tanggalLihat);

  /* ---------- Validasi Form (Tetap H-0 / Hari Ini) ---------- */
  const start = jamMulai ? toMin(jamMulai) : NaN;
  const end = jamSelesai ? toMin(jamSelesai) : NaN;
  const keduaTerisi = Boolean(jamMulai && jamSelesai);

  let pesanJam: string | null = null;
  if (keduaTerisi) {
    if (end <= start) pesanJam = 'Jam selesai harus setelah jam mulai';
    else if (start < JAM_BUKA_MENIT || end > JAM_TUTUP_MENIT)
      pesanJam = 'Jam peminjaman harus antara 06:00 dan 17:00';
  }
  const rentangValid = keduaTerisi && !pesanJam;

  const bentrok = rentangValid
    ? jadwal.data.find((b) => start < toMin(b.jam_selesai) && end > toMin(b.jam_mulai))
    : undefined;

  const status: { tone: Tone; teks: string } = !keduaTerisi
    ? { tone: 'warning', teks: 'Menunggu input' }
    : pesanJam
    ? { tone: 'danger', teks: 'Jam tidak valid' }
    : bentrok
    ? { tone: 'danger', teks: 'Bentrok' }
    : { tone: 'success', teks: 'Tersedia' };

  const labTerpilih = labs.find((l) => l.id === labId);

  /* ---------- Submit Peminjaman (Wajib Hari Ini) ---------- */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rentangValid || !labId || submitting) return;

    setSubmitting(true);
    try {
      const res = await createPeminjaman({
        labId,
        tanggal: hariIni, // Menggunakan hariIni agar mutlak H-0
        jamMulai,
        jamSelesai,
        alasan: alasan.trim() || undefined,
      });

      if (res.success) {
        notify({ type: 'success', message: 'Peminjaman berhasil diajukan!' });
        setJamMulai('');
        setJamSelesai('');
        setAlasan('');
        setTanggalLihat(hariIni); // Otomatis kembalikan view ke hari ini
        jadwal.refetch();
      } else {
        notify({
          type: 'error',
          message:
            res.error === 'Jadwal bentrok'
              ? 'Jadwal bentrok! Jam tersebut sudah dipakai, pilih jam lain.'
              : res.error,
        });
      }
    } catch {
      notify({ type: 'error', message: 'Gagal terhubung ke server, coba lagi.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (labs.length === 0) {
    return (
      <GlassCard className="p-6 text-sm text-slate-600">
        Belum ada laboratorium terdaftar. Hubungi admin.
      </GlassCard>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Dashboard Mahasiswa
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {labelTanggalID(hariIni)} · Cek jadwal lab hari kedepan, dan ajukan peminjaman untuk hari ini.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ---------- Form Peminjaman (Tetap untuk Hari Ini) ---------- */}
        <GlassCard className="p-5 sm:p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Form Peminjaman</h2>
            <StatusBadge tone={status.tone}>{status.teks}</StatusBadge>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="lab" className={labelCls}>
                Laboratorium
              </label>
              <select id="lab" value={labId} onChange={(e) => setLabId(e.target.value)} className={inputCls}>
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nama_lab}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className={labelCls}>Tanggal Peminjaman</span>
              <div className="flex items-center justify-between rounded-xl bg-slate-100/80 px-3.5 py-2.5 text-sm text-slate-700">
                <span>{labelTanggalID(hariIni)}</span>
                <StatusBadge tone="info">Hari ini</StatusBadge>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Peminjaman langsung hanya dapat diajukan untuk hari ini.
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
              <p className="-mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
                Bentrok dengan jadwal {bentrok.jam_mulai.slice(0, 5)}–{bentrok.jam_selesai.slice(0, 5)} (
                {bentrok.nama_peminjam}). Pilih jam lain.
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

            <button type="submit" disabled={!rentangValid || !labId || submitting} className={buttonCls}>
              {submitting && <Spinner />}
              {submitting ? 'Mengirim...' : 'Ajukan Peminjaman'}
            </button>
          </form>
        </GlassCard>

        {/* ---------- Viewer Jadwal (Bisa Ganti Tanggal Ke Depan/Sebelumnya) ---------- */}
        <div className="lg:col-span-3">
          <JadwalLab
            judul="Jadwal Laboratorium"
            subjudul={`${labTerpilih?.nama_lab ?? ''} · ${labelTanggalID(tanggalLihat)}`}
            aksiHeader={
              <div>
                <label htmlFor="tglLihatMahasiswa" className="sr-only">
                  Pilih Tanggal
                </label>
                <input
                  id="tglLihatMahasiswa"
                  type="date"
                  value={tanggalLihat}
                  onChange={(e) => e.target.value && setTanggalLihat(e.target.value)}
                  className={`${inputCls} py-2 text-xs sm:text-sm`}
                  title="Pilih tanggal untuk melihat jadwal hari lain"
                />
              </div>
            }
            bookings={jadwal.data}
            loading={jadwal.loading}
            error={jadwal.error}
            tanggal={tanggalLihat}
            hariIni={hariIni}
            peran="mahasiswa"
            saya={saya}
            // Fitur klik rentang jam kosong hanya aktif jika tanggal yang dilihat adalah hari ini
            rentangPilihan={tanggalLihat === hariIni && rentangValid ? { start, end, bentrok: !!bentrok } : null}
            onPilihRentang={tanggalLihat === hariIni ? (m, s) => {
              setJamMulai(m);
              setJamSelesai(s);
            } : undefined}
            onBerubah={jadwal.refetch}
            notify={notify}
          />
        </div>
      </div>

      <Toast toast={toast} onClose={closeToast} />
    </>
  );
}