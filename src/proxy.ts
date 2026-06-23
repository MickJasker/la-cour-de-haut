import { type NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale, type Locale } from "./i18n/routing";

// Pick the best supported locale from the Accept-Language header, falling back to
// the default. Hand-rolled (no negotiator/intl-localematcher deps) — adequate for
// our four locales.
function getLocale(request: NextRequest): Locale {
  const header = request.headers.get("accept-language");
  if (!header) return defaultLocale;

  const preferred = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of preferred) {
    const base = tag.split("-")[0];
    const match = locales.find((locale) => locale === base);
    if (match) return match;
  }

  return defaultLocale;
}

// Next.js 16: export named `proxy` (not `middleware`)
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const hasSession = Boolean(
      request.cookies.get("better-auth.session_token")?.value,
    );

    if (pathname === "/admin/login") {
      return NextResponse.next();
    }

    // All other /admin/* routes require a session cookie
    if (!hasSession) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // Locale routing: leave already-prefixed paths alone, otherwise redirect to the
  // negotiated locale (e.g. "/" -> "/nl", "/book" -> "/nl/book").
  const hasLocalePrefix = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  if (hasLocalePrefix) {
    return NextResponse.next();
  }

  const locale = getLocale(request);
  request.nextUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: [
    // Match all pathnames except static files, internals, and API routes
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
