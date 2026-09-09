import Link from "next/link";
import { redirect } from "next/navigation";
import Field from "@/components/Field";
import SubmitButton from "@/components/SubmitButton";
import SetupNotice from "@/components/SetupNotice";
import { loginAction } from "@/app/account/actions";
import { currentProfile } from "@/lib/account";
import { safeRedirectPath } from "@/lib/auth";
import { isSupabaseConfigured, missingSupabaseEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = { title: "Вход" };

export default async function LoginPage({ searchParams }) {
  const heading = <h1 className="mb-6 text-2xl font-semibold">Вход</h1>;

  if (!isSupabaseConfigured) {
    return (
      <section className="mx-auto max-w-sm">
        {heading}
        <SetupNotice missing={missingSupabaseEnv()} />
      </section>
    );
  }

  if (await currentProfile()) redirect("/account");

  const from = safeRedirectPath(searchParams?.from, "/account");
  const error = searchParams?.error;
  const email = searchParams?.email || "";

  return (
    <section className="mx-auto max-w-sm">
      {heading}

      {error && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <form action={loginAction} className="space-y-4">
        <input type="hidden" name="from" value={from} />

        <Field label="Почта" required>
          <input
            name="email"
            type="email"
            defaultValue={email}
            required
            autoFocus
            autoComplete="email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </Field>

        <Field label="Пароль" required>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </Field>

        <SubmitButton pendingLabel="Проверяю…" className="w-full">
          Войти
        </SubmitButton>
      </form>

      <p className="mt-6 text-sm text-gray-500">
        Нет учётной записи?{" "}
        <Link
          href={`/register?from=${encodeURIComponent(from)}`}
          className="text-accent hover:underline"
        >
          Зарегистрироваться
        </Link>
      </p>
      <p className="mt-2 text-xs text-gray-400">
        Восстановления пароля пока нет — оно появится вместе с отправкой писем.
        Забыли пароль — напишите администратору.
      </p>
    </section>
  );
}
