import { logout } from '@/app/actions/auth';
import { GlowBackground, Logo } from '@/components/auth-ui';

export function AppShell({
  nama,
  role,
  children,
}: {
  nama: string;
  role: 'mahasiswa' | 'kaprodi';
  children: React.ReactNode;
}) {
  return (
    <GlowBackground>
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          {/* Logo sudah memuat nama kampus: tidak ada teks tambahan */}
          <Logo />

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">{nama}</p>
              <p className="text-xs text-slate-500">{role === 'kaprodi' ? 'Kaprodi / Dosen' : 'Mahasiswa'}</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
              >
                Keluar
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">{children}</main>
    </GlowBackground>
  );
}