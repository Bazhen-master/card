import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import SetupNotice from "@/components/SetupNotice";
import { TARIFF_LABELS } from "@/lib/tariffs";
import { requireAdmin } from "@/lib/require-admin";
import {
  getSupabase,
  isSupabaseConfigured,
  missingSupabaseEnv,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = { title: "Заявки на покупку" };

function formatDate(value) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminLeadsPage() {
  await requireAdmin();

  if (!isSupabaseConfigured) {
    return (
      <section>
        <AdminHeader title="Заявки на покупку" backHref="/admin" backLabel="Админка" />
        <SetupNotice missing={missingSupabaseEnv()} />
      </section>
    );
  }

  const supabase = getSupabase();
  const { data: leads } = await supabase
    .from("leads")
    .select("id, tariff, contact, created_at, decks(id, title)")
    .order("created_at", { ascending: false })
    .limit(200);

  const list = leads ?? [];
  const withContact = list.filter((lead) => lead.contact);

  // Считаем два среза: по тарифу (за что готовы платить) и по колоде (что
  // именно хотят). Ради этого этап и делался.
  const byTariff = new Map();
  const byDeck = new Map();
  for (const lead of list) {
    byTariff.set(lead.tariff, (byTariff.get(lead.tariff) ?? 0) + 1);
    const title = lead.decks?.title ?? "без колоды";
    byDeck.set(title, (byDeck.get(title) ?? 0) + 1);
  }

  return (
    <section className="space-y-8">
      <AdminHeader title="Заявки на покупку" backHref="/admin" backLabel="Админка" />

      <p className="text-sm text-gray-500">
        Настоящей оплаты за кнопками нет: этот отчёт показывает, по каким
        колодам и за какой тариф нажимают. Клик считается сразу, контакт —
        только если человек его оставил.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-2 font-medium">Нажатий по тарифу</h2>
          {byTariff.size === 0 ? (
            <p className="text-sm text-gray-500">Пока ни одного.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {[...byTariff.entries()].map(([tariff, count]) => (
                <li key={tariff} className="flex justify-between gap-4">
                  <span className="text-gray-700">{TARIFF_LABELS[tariff] ?? tariff}</span>
                  <span className="text-gray-500">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-2 font-medium">Нажатий по колоде</h2>
          {byDeck.size === 0 ? (
            <p className="text-sm text-gray-500">Пока ни одного.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {[...byDeck.entries()].map(([title, count]) => (
                <li key={title} className="flex justify-between gap-4">
                  <span className="text-gray-700">{title}</span>
                  <span className="text-gray-500">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-medium">
          Контакты ({withContact.length} из {list.length} нажатий)
        </h2>

        {withContact.length === 0 ? (
          <p className="text-sm text-gray-500">
            Контактов пока нет — люди нажимали, но не оставляли почту.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white text-sm">
            {withContact.map((lead) => (
              <li key={lead.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                <span className="text-gray-800">{lead.contact}</span>
                <span className="text-gray-500">
                  {TARIFF_LABELS[lead.tariff] ?? lead.tariff}
                  {lead.decks?.title && (
                    <>
                      {" · "}
                      <Link
                        href={`/admin/decks/${lead.decks.id}`}
                        className="hover:text-accent"
                      >
                        {lead.decks.title}
                      </Link>
                    </>
                  )}
                  {" · "}
                  {formatDate(lead.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
