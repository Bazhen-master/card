import AdminHeader from "@/components/AdminHeader";
import Banner from "@/components/Banner";
import SetupNotice from "@/components/SetupNotice";
import { adjustBalance, toggleBlock } from "../actions";
import { COMMISSION_PERCENT } from "@/lib/balance";
import { formatMoney, formatPrice } from "@/lib/format";
import { requireAdmin } from "@/lib/require-admin";
import {
  getSupabase,
  isSupabaseConfigured,
  missingSupabaseEnv,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = { title: "Пользователи" };

export default async function AdminUsersPage({ searchParams }) {
  await requireAdmin();

  if (!isSupabaseConfigured) {
    return (
      <section>
        <AdminHeader title="Пользователи" backHref="/admin" backLabel="Админка" />
        <SetupNotice missing={missingSupabaseEnv()} />
      </section>
    );
  }

  const supabase = getSupabase();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, display_name, is_blocked, created_at")
    .order("created_at", { ascending: false });

  // Балансы считаем одним запросом на всех: журнал маленький, а ходить в базу
  // по строке на каждого пользователя — лишнее.
  const { data: entries } = await supabase
    .from("balance_entries")
    .select("profile_id, delta");

  const balances = new Map();
  for (const row of entries ?? []) {
    balances.set(row.profile_id, (balances.get(row.profile_id) ?? 0) + row.delta);
  }

  const list = profiles ?? [];

  return (
    <section className="space-y-8">
      <AdminHeader title="Пользователи" backHref="/admin" backLabel="Админка" />
      <Banner ok={searchParams?.ok} error={searchParams?.error} />

      <p className="text-sm text-gray-500">
        Платёжной системы пока нет: баланс пополняется здесь, вручную, после
        перевода денег. Комиссия площадки с продажи — {COMMISSION_PERCENT} %,
        остаток при делении идёт автору.
      </p>

      {list.length === 0 ? (
        <p className="text-gray-500">Зарегистрированных пока нет.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((profile) => (
            <li
              key={profile.id}
              className="space-y-3 rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {profile.display_name || "без имени"}{" "}
                    <span className="text-sm font-normal text-gray-500">
                      {profile.email}
                    </span>
                  </p>
                  {profile.is_blocked && (
                    <p className="text-sm text-red-600">Заблокирован</p>
                  )}
                </div>
                <p className="text-lg text-accent">
                  {formatMoney(balances.get(profile.id) ?? 0)}
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <form action={adjustBalance} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="profile" value={profile.id} />
                  <label className="text-xs text-gray-500">
                    Сумма, ₽
                    <input
                      name="amount"
                      type="number"
                      step="0.1"
                      required
                      placeholder="100"
                      className="mt-1 block w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
                    />
                  </label>
                  <label className="text-xs text-gray-500">
                    Комментарий
                    <input
                      name="comment"
                      placeholder="Перевод от 07.09"
                      className="mt-1 block w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
                  >
                    Начислить
                  </button>
                </form>

                <form action={toggleBlock}>
                  <input type="hidden" name="profile" value={profile.id} />
                  <input
                    type="hidden"
                    name="blocked"
                    value={profile.is_blocked ? "1" : "0"}
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-accent hover:text-accent"
                  >
                    {profile.is_blocked ? "Разблокировать" : "Заблокировать"}
                  </button>
                </form>
              </div>

              <p className="text-xs text-gray-400">
                Отрицательная сумма — списание. Каждое начисление остаётся в
                журнале операций и видно пользователю в кабинете.
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
