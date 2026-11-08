'use client';

import { useState, useTransition } from 'react';
import { createPeminjaman } from '@/app/actions/peminjaman';

export function FormPeminjaman({ labId }: { labId: string }) {
  const [pending, startTransition] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await createPeminjaman({
        labId,
        tanggal: fd.get('tanggal') as string,   // <input type="date">
        jamMulai: fd.get('jamMulai') as string, // <input type="time">
        jamSelesai: fd.get('jamSelesai') as string,
        alasan: (fd.get('alasan') as string) || undefined,
      });
      setPesan(res.success ? 'Peminjaman berhasil diajukan' : res.error);
    });
  }

  return (/* form Tailwind Anda, tombol disabled={pending} */ null);
}