'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { JadwalItem } from '@/lib/jadwal';

/** Ambil jadwal 1 lab pada 1 tanggal + update realtime. */
export function useJadwalLab(labId: string, tanggal: string) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<JadwalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  const refetch = useCallback(async () => {
    if (!labId || !tanggal) return;
    const myReq = ++reqRef.current;

    const { data: rows, error: err } = await supabase.rpc('get_jadwal_lab', {
      p_lab_id: labId,
      p_tanggal: tanggal,
    });

    if (myReq !== reqRef.current) return; // abaikan respons usang
    if (err) setError('Gagal memuat jadwal lab');
    else {
      setError(null);
      setData((rows ?? []) as JadwalItem[]);
    }
    setLoading(false);
  }, [supabase, labId, tanggal]);

  useEffect(() => {
    if (!labId || !tanggal) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refetch();

    const channel = supabase
      .channel(`jadwal-${labId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'peminjaman', filter: `lab_id=eq.${labId}` },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, labId, tanggal, refetch]);

  return { data, loading, error, refetch };
}