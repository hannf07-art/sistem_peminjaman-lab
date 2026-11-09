export type Lab = { id: string; nama_lab: string };
export type Saya = { id: string; prodi: string | null; angkatan: number | null };

export type JadwalItem = {
  id: string;
  user_id: string;
  jam_mulai: string; // "HH:MM:SS"
  jam_selesai: string;
  alasan: string | null;
  jenis: 'pinjam' | 'mk_wajib';
  angkatan_target: number | null;
  nama_peminjam: string;
  prodi: string | null;
  angkatan: number | null;
  role_peminjam: 'pending' | 'mahasiswa' | 'kaprodi';
};

export const JAM_BUKA_MENIT = 6 * 60; // 06:00
export const JAM_TUTUP_MENIT = 17 * 60; // 17:00
export const MAKS_RENTANG_HARI = 366;

export const HARI_KULIAH = [
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
];

export const NAMA_HARI: Record<number, string> = {
  0: 'Minggu', 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu',
};

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/* ---------- Jam ---------- */
export const toMin = (t: string) => {
  const [h, m] = t.split(':');
  return Number(h) * 60 + Number(m);
};

export const fmtJam = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/* ---------- Tanggal (aritmetika UTC, deterministik) ---------- */
const MS_HARI = 86_400_000;

function utcMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function tanggalValid(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return new Date(utcMs(ymd)).toISOString().slice(0, 10) === ymd;
}

export function selisihHari(mulai: string, selesai: string): number {
  return Math.round((utcMs(selesai) - utcMs(mulai)) / MS_HARI);
}

/** Semua tanggal berhari `hari` (0=Min ... 6=Sab) di antara mulai..selesai (inklusif). */
export function daftarTanggalBerulang(mulai: string, selesai: string, hari: number): string[] {
  if (!tanggalValid(mulai) || !tanggalValid(selesai)) return [];
  const rentang = selisihHari(mulai, selesai);
  if (rentang < 0 || rentang > MAKS_RENTANG_HARI) return [];

  const awal = utcMs(mulai);
  const akhir = utcMs(selesai);
  const dowAwal = new Date(awal).getUTCDay();

  const hasil: string[] = [];
  for (let cur = awal + ((hari - dowAwal + 7) % 7) * MS_HARI; cur <= akhir; cur += 7 * MS_HARI) {
    hasil.push(new Date(cur).toISOString().slice(0, 10));
  }
  return hasil;
}

/** "Senin, 9 November 2026". Tanpa Intl agar hasil server = client. */
export function labelTanggalID(ymd: string): string {
  if (!tanggalValid(ymd)) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(utcMs(ymd)).getUTCDay();
  return `${NAMA_HARI[dow]}, ${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

/** "9 Nov" */
export function labelTanggalPendek(ymd: string): string {
  if (!tanggalValid(ymd)) return '';
  const [, m, d] = ymd.split('-').map(Number);
  return `${d} ${NAMA_BULAN[m - 1].slice(0, 3)}`;
}