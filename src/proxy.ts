import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16: export named `proxy` (not `middleware`)
export const proxy = createMiddleware(routing);

export const config = {
  matcher: [
    // Match all pathnames except static files, internals, and API routes
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
