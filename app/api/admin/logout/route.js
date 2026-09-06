import { ADMIN_COOKIE } from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";

export async function POST() {
  const response = redirectTo("/admin/login", { status: 303 });
  response.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
