import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  safeRedirectPath,
  sessionToken,
} from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";

export async function POST(request) {
  const form = await request.formData();
  const password = String(form.get("password") || "");
  const from = safeRedirectPath(form.get("from"));
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || password !== expected) {
    const params = new URLSearchParams({ from, error: "1" });
    return redirectTo(`/admin/login?${params}`, { status: 303 });
  }

  const response = redirectTo(from, { status: 303 });
  response.cookies.set(ADMIN_COOKIE, await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  return response;
}
