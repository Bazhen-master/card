import AdminHeader from "@/components/AdminHeader";
import Banner from "@/components/Banner";
import Field from "@/components/Field";
import SetupNotice from "@/components/SetupNotice";
import SubmitButton from "@/components/SubmitButton";
import { saveSettings } from "../actions";
import { COMMISSION_PERCENT, GENERATION_COST, GENERATION_PRICE } from "@/lib/balance";
import { formatMoney } from "@/lib/format";
import { PER_SESSION_PER_DAY } from "@/lib/generation-limit";
import { requireAdmin } from "@/lib/require-admin";
import { readSettings } from "@/lib/settings";
import {
  getSupabase,
  isSupabaseConfigured,
  missingSupabaseEnv,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = { title: "Настройки" };

export default async function AdminSettingsPage({ searchParams }) {
  await requireAdmin();

  if (!isSupabaseConfigured) {
    return (
      <section>
        <AdminHeader title="Настройки" backHref="/admin" backLabel="Админка" />
        <SetupNotice missing={missingSupabaseEnv()} />
      </section>
    );
  }

  const settings = await readSettings(getSupabase());

  return (
    <section className="space-y-8">
      <AdminHeader title="Настройки" backHref="/admin" backLabel="Админка" />
      <Banner ok={searchParams?.ok} error={searchParams?.error} />

      {!settings.tableReady && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          В базе нет таблицы <code>settings</code>: сайт пока работает на
          значениях по умолчанию, а сохранить новые не сможет. Откройте Supabase
          → SQL Editor, выполните файл <code>supabase/schema.sql</code> из
          репозитория и вернитесь сюда.
        </p>
      )}

      <form action={saveSettings} className="max-w-xl space-y-5">
        <Field
          label="Стартовый бонус при регистрации, ₽"
          hint="Начисляется автоматически, как только человек завёл учётную запись. 0 — не начислять."
        >
          <input
            name="signup_bonus"
            type="number"
            min="0"
            max="10000"
            step="0.5"
            defaultValue={settings.signup_bonus / 100}
            className="w-40 rounded-lg border border-gray-300 px-3 py-2"
          />
        </Field>

        <Field
          label="Бесплатный период, дней"
          hint="Сколько дней после регистрации действуют бесплатные генерации. Дальше рисовать можно только за баллы. 0 — бесплатные без ограничения по сроку. У посетителя без учётной записи отсчёт идёт от его первой карты."
        >
          <input
            name="free_period_days"
            type="number"
            min="0"
            max="365"
            step="1"
            defaultValue={settings.free_period_days}
            className="w-40 rounded-lg border border-gray-300 px-3 py-2"
          />
        </Field>

        <SubmitButton pendingLabel="Сохраняю…">Сохранить</SubmitButton>
      </form>

      <div className="space-y-2">
        <h2 className="font-medium">Что задано в коде</h2>
        <p className="max-w-2xl text-sm text-gray-500">
          Эти значения меняются переменными окружения в панели хостинга — после
          правки нужен передеплой. Названия переменных указаны рядом.
        </p>
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white text-sm">
          <li className="flex items-baseline justify-between gap-4 p-3">
            <span className="text-gray-700">
              Комиссия площадки с продажи
              <span className="block text-xs text-gray-400">COMMISSION_PERCENT</span>
            </span>
            <span className="shrink-0 tabular-nums">{COMMISSION_PERCENT} %</span>
          </li>
          <li className="flex items-baseline justify-between gap-4 p-3">
            <span className="text-gray-700">
              Цена генерации сверх бесплатных
              <span className="block text-xs text-gray-400">GENERATION_PRICE</span>
            </span>
            <span className="shrink-0 tabular-nums">{formatMoney(GENERATION_PRICE)}</span>
          </li>
          <li className="flex items-baseline justify-between gap-4 p-3">
            <span className="text-gray-700">
              Себестоимость генерации — только для отчёта
              <span className="block text-xs text-gray-400">GENERATION_COST</span>
            </span>
            <span className="shrink-0 tabular-nums">{formatMoney(GENERATION_COST)}</span>
          </li>
          <li className="flex items-baseline justify-between gap-4 p-3">
            <span className="text-gray-700">
              Бесплатных генераций в сутки
              <span className="block text-xs text-gray-400">задано в коде</span>
            </span>
            <span className="shrink-0 tabular-nums">{PER_SESSION_PER_DAY}</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
