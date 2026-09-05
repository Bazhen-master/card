import { safeRedirectPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Вход в админку" };

export default function AdminLoginPage({ searchParams }) {
  const from = safeRedirectPath(searchParams?.from);
  const hasError = Boolean(searchParams?.error);
  const passwordConfigured = Boolean(process.env.ADMIN_PASSWORD);

  return (
    <section className="max-w-sm mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Вход в админку</h1>

      {!passwordConfigured && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Не задана переменная окружения <code>ADMIN_PASSWORD</code>. Пока её нет,
          вход в админку невозможен.
        </p>
      )}

      {hasError && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Неверный пароль.
        </p>
      )}

      <form action="/api/admin/login" method="post" className="space-y-4">
        <input type="hidden" name="from" value={from} />
        <div>
          <label htmlFor="password" className="block text-sm mb-1 text-gray-700">
            Пароль
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoFocus
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90"
        >
          Войти
        </button>
      </form>
    </section>
  );
}
