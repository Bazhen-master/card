import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  safeRedirectPath,
  sessionToken,
} from "@/lib/auth";

export async function POST(request) {
  const form = await request.formData();
  const password = String(form.get("password") || "");
  const from = safeRedirectPath(form.get("from"));
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || password !== expected) {
    const back = new URL("/admin/login", request.url);
    back.searchParams.set("from", from);
    back.searchParams.set("error", "1");
    return NextResponse.redirect(back, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(from, request.url), { status: 303 });
  response.cookies.set(ADMIN_COOKIE, await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  return response;
}
