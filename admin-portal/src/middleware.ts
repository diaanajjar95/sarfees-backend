import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login'];
const ACCESS_COOKIE = 'sarfees_admin_at';
const ADMIN_COOKIE = 'sarfees_admin_user';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public marketing page (temporary home until it moves to its own
  // project) — no admin session required, including its static assets.
  if (pathname === '/landing' || pathname.startsWith('/landing/')) {
    return NextResponse.next();
  }

  const hasAccess = !!req.cookies.get(ACCESS_COOKIE)?.value;
  const adminCookie = req.cookies.get(ADMIN_COOKIE)?.value;

  // Forced password change always wins — even authenticated admins must clear it first.
  if (adminCookie) {
    try {
      const admin = JSON.parse(adminCookie) as { mustChangePassword?: boolean };
      if (
        admin.mustChangePassword &&
        pathname !== '/change-password' &&
        pathname !== '/login'
      ) {
        const url = req.nextUrl.clone();
        url.pathname = '/change-password';
        return NextResponse.redirect(url);
      }
    } catch {
      /* fall through */
    }
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    if (hasAccess) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!hasAccess) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
