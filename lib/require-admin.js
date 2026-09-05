import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, sessionToken } from "@/lib/auth";

// Дублирует проверку из middleware. Middleware — первая линия защиты, но
// полагаться только на неё нельзя: у Next.js уже были уязвимости с её обходом
// (CVE-2025-29927). Здесь проверка выполняется в самом обработчике страницы
// или server action, куда подделанным заголовком не пролезть.
export async function requireAdmin() {
  const expected = await sessionToken();
  const actual = cookies().get(ADMIN_COOKIE)?.value;
  if (!expected || actual !== expected) redirect("/admin/login");
}
