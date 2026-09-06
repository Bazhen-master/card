import { NextResponse } from "next/server";
import { ADMIN_COOKIE, sessionToken } from "./lib/auth";
import { redirectFromMiddleware } from "./lib/redirect";

// Пускаем в /admin/* только с валидной cookie. Страница входа исключена,
// иначе получился бы бесконечный редирект.
export async function middleware(request) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const expected = await sessionToken();
  const actual = request.cookies.get(ADMIN_COOKIE)?.value;
  if (expected && actual === expected) return NextResponse.next();

  const params = new URLSearchParams({ from: pathname });
  return redirectFromMiddleware(request, `/admin/login?${params}`);
}

export const config = {
  matcher: ["/admin/:path*"],
};
