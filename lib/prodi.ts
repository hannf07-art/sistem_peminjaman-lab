export const DAFTAR_PRODI: { fakultas: string; prodi: string[] }[] = [
  {
    fakultas: 'Fakultas Kesehatan dan Teknologi',
    prodi: [
      'S1 Farmasi',
      'S1 Keperawatan & Profesi Ners',
      'S1 Kebidanan & Profesi Bidan',
      'D4 MIKES',
      'S1 Teknologi Informasi',
      'D3 Keperawatan',
      'D3 Kebidanan',
    ],
  },
  {
    fakultas: 'Fakultas Ekonomi, Bisnis, dan Humaniora',
    prodi: ['S1 Manajemen', 'S1 Hukum'],
  },
];

export const SEMUA_PRODI: string[] = DAFTAR_PRODI.flatMap((f) => f.prodi);