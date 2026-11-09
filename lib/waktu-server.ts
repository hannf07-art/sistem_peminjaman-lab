/** Tanggal hari ini (YYYY-MM-DD) menurut WIB. Panggil hanya di Server Component / Server Action. */
export function hariIniWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}