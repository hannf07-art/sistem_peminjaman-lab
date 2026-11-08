import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const ROLE_DIIZINKAN = ['mahasiswa', 'kaprodi'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() memverifikasi token ke server Supabase (lebih aman dari getSession)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = pathname === '/peminjaman' || pathname.startsWith('/peminjaman/');
  const isAuthPage = pathname === '/login' || pathname === '/register';

  // Redirect sambil membawa cookie sesi yang mungkin baru di-refresh
  const redirectTo = (path: string, search = '') => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = search;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  // 1) Belum login -> /login
  if (!user && isProtected) {
    return redirectTo('/login');
  }

  // 2) Sudah login: cek role hanya untuk halaman yang relevan
  if (user && (isProtected || isAuthPage)) {
    const { data: profil } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const diizinkan = !!profil && ROLE_DIIZINKAN.includes(profil.role);

    if (isProtected && !diizinkan) {
      return redirectTo('/login', '?status=pending'); // pending / profil tidak ada
    }
    if (isAuthPage && diizinkan) {
      return redirectTo('/peminjaman'); // sudah login & disetujui
    }
  }

  return response;
}

export const config = {
  matcher: [
    // semua route kecuali aset statis (agar token sesi ikut di-refresh)
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};