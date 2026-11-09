'use client';

import { useMemo, useState, useTransition } from 'react';
import { createJadwalRutinKaprodi } from '@/app/actions/peminjaman';
import {
  Alert,
  GlassCard,
  Spinner,
  StatusBadge,
  Toast,
  buttonCls,
  inputCls,
  labelCls,
  secondaryButtonCls,
  useToast,
} from '@/components/auth-ui';
import { JadwalLab } from '@/components/peminjaman/JadwalLab';
import { useJadwalLab } from '@/components/peminjaman/useJadwalLab';
import {
  HARI_KULIAH,
  MAKS_RENTANG_HARI,
  NAMA_HARI,
  daftarTanggalBerulang,
  labelTanggalID,
  labelTanggalPendek,
  selisihHari,
  tanggalValid,
  type Lab,
  type Saya,
} from '@/lib/jadwal';

type Hasil = { dibuat: number; dibatalkan: number; dilewati: number; totalTanggal: number };

export default function DashboardKaprodi({
  labs,
  hariIni,
  tahunIni,
  saya,
}: {
  labs: Lab[];
  hariIni: string;
  tahunIni: number; // dihitung di server
  saya: Saya;
}) {
  /* ---------- State form ---------- */
  const [labId, setLabId] = useState(labs[0]?.id ?? '');
  const [hari, setHari] = useState(1);
  const [jamMulai, setJamMulai] = useState('');
  const [jamSelesai, setJamSelesai] = useState('');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [angkatanTarget, setAngkatanTarget] = useState('');
  const [namaMk, setNamaMk] = useState('');
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [memproses, startTransition] = useTransition();

  /* ---------- State viewer jadwal ---------- */
  const [tanggalLihat, setTanggalLihat] = useState(hariIni);

  const { toast, notify, closeToast } = useToast();
  const jadwal = useJadwalLab(labId, tanggalLihat);
  const labTerpilih = labs.find((l) => l.id === labId);

  /* ---------- Preview & validasi (fungsi murni, tanpa Date.now) ---------- */
  const keduaTanggal = tanggalValid(tanggalMulai) && tanggalValid(tanggalSelesai);
  const rentang = keduaTanggal ? selisihHari(tanggalMulai, tanggalSelesai) : 0;
  const rentangSalah = keduaTanggal && rentang < 0;
  const rentangPanjang = keduaTanggal && rentang > MAKS_RENTANG_HARI;

  const semuaTanggal = useMemo(
    () => daftarTanggalBerulang(tanggalMulai, tanggalSelesai, hari),
    [tanggalMulai, tanggalSelesai, hari]
  );
  const akanDibuat = useMemo(() => semuaTanggal.filter((t) => t >= hariIni), [semuaTanggal, hariIni]);
  const terlewat = semuaTanggal.length - akanDibuat.length;

  const pesanJam = jamMulai && jamSelesai && jamSelesai <= jamMulai ? 'Jam selesai harus setelah jam mulai' : null;

  const formValid =
    !!labId &&
    !!jamMulai &&
    !!jamSelesai &&
    !pesanJam &&
    keduaTanggal &&
    !rentangSalah &&
    !rentangPanjang &&
    !!angkatanTarget &&
    namaMk.trim().length >= 3 &&
    akanDibuat.length > 0;

  const opsiAngkatan = Array.from({ length: 8 }, (_, i) => tahunIni - i);

  /* ---------- Submit ---------- */
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (formValid) setKonfirmasi(true); // tahap konfirmasi dulu (bisa membatalkan booking mahasiswa)
  }

  function kirim() {
    startTransition(async () => {
      const res = await createJadwalRutinKaprodi({
        labId,
        hari,
        jamMulai,
        jamSelesai,
        tanggalMulai,
        tanggalSelesai,
        angkatanTarget,
        namaMk,
      });

      setKonfirmasi(false);
      if (res.success) {
        setHasil(res.data);
        notify({ type: 'success', message: `${res.data.dibuat} jadwal MK Wajib berhasil dibuat` });
        setJamMulai('');
        setJamSelesai('');
        setNamaMk('');
        jadwal.refetch();
      } else {
        notify({ type: 'error', message: res.error });
      }
    });
  }

  if (labs.length === 0) {
    return (
      <GlassCard className="p-6 text-sm text-slate-600">
        Belum ada laboratorium terdaftar. Tambahkan lewat tabel <code>labs</code>.
      </GlassCard>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Dashboard Kaprodi</h1>
        <p className="mt-1 text-sm text-slate-500">
          Atur jadwal MK Wajib semester dan kelola seluruh peminjaman laboratorium.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ================= FORM BULK INSERT ================= */}
        <GlassCard className="p-5 sm:p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Jadwal MK Wajib</h2>
            {formValid ? (
              <StatusBadge tone="success">Siap disimpan</StatusBadge>
            ) : (
              <StatusBadge tone="warning">Lengkapi form</StatusBadge>
            )}
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label htmlFor="labK" className={labelCls}>
                Laboratorium
              </label>
              <select id="labK" value={labId} onChange={(e) => setLabId(e.target.value)} className={inputCls}>
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nama_lab}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className={labelCls}>Hari</span>
              <div role="radiogroup" aria-label="Hari" className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
                {HARI_KULIAH.map((h) => (
                  <button
                    key={h.value}
                    type="button"
                    role="radio"
                    aria-checked={hari === h.value}
                    onClick={() => setHari(h.value)}
                    className={`rounded-lg px-2 py-2 text-xs font-semibold ring-1 transition ${
                      hari === h.value
                        ? 'bg-emerald-600 text-white ring-emerald-600'
                        : 'bg-white text-slate-600 ring-slate-200 hover:bg-emerald-50'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="jamMulaiK" className={labelCls}>
                  Jam Mulai
                </label>
                <input
                  id="jamMulaiK"
                  type="time"
                  required
                  value={jamMulai}
                  onChange={(e) => setJamMulai(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="jamSelesaiK" className={labelCls}>
                  Jam Selesai
                </label>
                <input
                  id="jamSelesaiK"
                  type="time"
                  required
                  value={jamSelesai}
                  onChange={(e) => setJamSelesai(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            {pesanJam && <p className="-mt-2 text-sm text-rose-600">{pesanJam}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tglMulai" className={labelCls}>
                  Kuliah Mulai
                </label>
                <input
                  id="tglMulai"
                  type="date"
                  required
                  value={tanggalMulai}
                  onChange={(e) => setTanggalMulai(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="tglSelesai" className={labelCls}>
                  Kuliah Selesai
                </label>
                <input
                  id="tglSelesai"
                  type="date"
                  required
                  value={tanggalSelesai}
                  onChange={(e) => setTanggalSelesai(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            {rentangSalah && <p className="-mt-2 text-sm text-rose-600">Tanggal selesai harus setelah tanggal mulai</p>}
            {rentangPanjang && (
              <p className="-mt-2 text-sm text-rose-600">Rentang tanggal maksimal {MAKS_RENTANG_HARI} hari</p>
            )}

            <div>
              <label htmlFor="angkatanTarget" className={labelCls}>
                Target Angkatan
              </label>
              <select
                id="angkatanTarget"
                required
                value={angkatanTarget}
                onChange={(e) => setAngkatanTarget(e.target.value)}
                className={inputCls}
              >
                <option value="" disabled>
                  Pilih angkatan yang mengikuti MK ini
                </option>
                {opsiAngkatan.map((a) => (
                  <option key={a} value={a}>
                    Angkatan {a}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-500">
                Hanya mahasiswa prodi Anda di angkatan ini yang bisa membatalkan jadwal bila dosen berhalangan.
              </p>
            </div>

            <div>
              <label htmlFor="namaMk" className={labelCls}>
                Nama MK / Nama Dosen
              </label>
              <input
                id="namaMk"
                type="text"
                required
                minLength={3}
                maxLength={200}
                value={namaMk}
                onChange={(e) => setNamaMk(e.target.value)}
                placeholder="Contoh: Basis Data – Bu Rina"
                className={inputCls}
              />
            </div>

            {/* Preview pertemuan */}
            {keduaTanggal && !rentangSalah && !rentangPanjang && (
              <div className="rounded-xl bg-emerald-50/70 p-3.5 text-sm ring-1 ring-emerald-100">
                {semuaTanggal.length === 0 ? (
                  <p className="text-slate-600">Tidak ada hari {NAMA_HARI[hari]} pada rentang ini.</p>
                ) : (
                  <>
                    <p className="font-medium text-slate-800">
                      {akanDibuat.length} pertemuan setiap {NAMA_HARI[hari]}
                      {terlewat > 0 && (
                        <span className="font-normal text-amber-700"> ({terlewat} tanggal lampau dilewati)</span>
                      )}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {akanDibuat.slice(0, 6).map((t) => (
                        <span key={t} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-600 ring-1 ring-emerald-100">
                          {labelTanggalPendek(t)}
                        </span>
                      ))}
                      {akanDibuat.length > 6 && (
                        <span className="px-1 text-xs text-slate-500">+{akanDibuat.length - 6} lainnya</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tombol / konfirmasi */}
            {!konfirmasi ? (
              <button type="submit" disabled={!formValid || memproses} className={buttonCls}>
                Simpan Jadwal Semester
              </button>
            ) : (
              <div className="space-y-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
                <p className="text-sm font-medium text-amber-900">
                  Simpan {akanDibuat.length} jadwal {NAMA_HARI[hari]} ({jamMulai}–{jamSelesai}) di{' '}
                  {labTerpilih?.nama_lab} untuk angkatan {angkatanTarget}?
                </p>
                <p className="text-xs text-amber-800">
                  Peminjaman mahasiswa yang bentrok akan dibatalkan otomatis. Bila bentrok dengan jadwal
                  Kaprodi/MK lain, seluruh proses dibatalkan dan tidak ada yang tersimpan.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setKonfirmasi(false)} disabled={memproses} className={secondaryButtonCls}>
                    Kembali
                  </button>
                  <button
                    type="button"
                    onClick={kirim}
                    disabled={memproses}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {memproses && <Spinner />}
                    {memproses ? 'Menyimpan...' : 'Ya, Simpan'}
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Hasil terakhir */}
          {hasil && (
            <div className="mt-5 space-y-2">
              <Alert type="success">
                Jadwal tersimpan untuk {hasil.dibuat} dari {hasil.totalTanggal} tanggal.
              </Alert>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="success">{hasil.dibuat} jadwal dibuat</StatusBadge>
                {hasil.dibatalkan > 0 && (
                  <StatusBadge tone="danger">{hasil.dibatalkan} booking mahasiswa dibatalkan</StatusBadge>
                )}
                {hasil.dilewati > 0 && <StatusBadge tone="warning">{hasil.dilewati} tanggal lampau dilewati</StatusBadge>}
              </div>
            </div>
          )}
        </GlassCard>

        {/* ================= VIEWER JADWAL + CABUT PAKSA ================= */}
        <div className="lg:col-span-3">
          <JadwalLab
            judul="Jadwal Lab"
            subjudul={`${labTerpilih?.nama_lab ?? ''} · ${labelTanggalID(tanggalLihat)}`}
            aksiHeader={
              <div>
                <label htmlFor="tglLihat" className="sr-only">
                  Tanggal yang ditampilkan
                </label>
                <input
                  id="tglLihat"
                  type="date"
                  value={tanggalLihat}
                  onChange={(e) => e.target.value && setTanggalLihat(e.target.value)}
                  className={`${inputCls} py-2`}
                />
              </div>
            }
            bookings={jadwal.data}
            loading={jadwal.loading}
            error={jadwal.error}
            tanggal={tanggalLihat}
            hariIni={hariIni}
            peran="kaprodi"
            saya={saya}
            onBerubah={jadwal.refetch}
            notify={notify}
          />
        </div>
      </div>

      <Toast toast={toast} onClose={closeToast} />
    </>
  );
}