import Link from "next/link";
import { redirect } from "next/navigation";
import Field from "@/components/Field";
import SubmitButton from "@/components/SubmitButton";
import SetupNotice from "@/components/SetupNotice";
import { registerAction } from "@/app/account/actions";
import { MIN_PASSWORD, currentProfile } from "@/lib/account";
import { safeRedirectPath } from "@/lib/auth";
import { isSupabaseConfigured, missingSupabaseEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = { title: "Регистрация" };

export default async function RegisterPage({ searchParams }) {
  const heading = <h1 className="mb-6 text-2xl font-semibold">Регистрация</h1>;

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

      <p className="mb-4 text-sm text-gray-500">
        Учётная запись нужна, чтобы карты, которые вы нарисовали, сохранялись
        в кабинете и не терялись вместе с историей браузера.
      </p>

      {error && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <form action={registerAction} className="space-y-4">
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

        <Field label="Пароль" hint={`Не короче ${MIN_PASSWORD} символов.`} required>
          <input
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </Field>

        <Field label="Пароль ещё раз" required>
          <input
            name="repeat"
            type="password"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </Field>

        <label className="flex items-start gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-0.5 h-4 w-4 accent-accent"
          />
          <span>
            Согласен на обработку персональных данных: адрес почты нужен для
            входа и связи, третьим лицам он не передаётся.
          </span>
        </label>

        <SubmitButton pendingLabel="Создаю…" className="w-full">
          Зарегистрироваться
        </SubmitButton>
      </form>

      <p className="mt-6 text-sm text-gray-500">
        Уже есть учётная запись?{" "}
        <Link
          href={`/login?from=${encodeURIComponent(from)}`}
          className="text-accent hover:underline"
        >
          Войти
        </Link>
      </p>
    </section>
  );
}
