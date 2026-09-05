export const ADMIN_COOKIE = "mc_admin";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12; // 12 часов

// Токен сессии — хеш от пароля из переменной окружения. Считается и в
// middleware (Edge runtime), и в API-роуте, поэтому используем Web Crypto,
// доступный в обоих, а не node:crypto.
export async function sessionToken() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  const data = new TextEncoder().encode(`metaphor-cards:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Защита от open redirect: принимаем только внутренние пути.
export function safeRedirectPath(value, fallback = "/admin") {
  const path = String(value || "");
  if (path.startsWith("/") && !path.startsWith("//")) return path;
  return fallback;
}
