import AdminHeader from "@/components/AdminHeader";
import SetupNotice from "@/components/SetupNotice";
import { financeReport } from "@/lib/finance";
import { formatDate, formatMoney, pluralGenerations } from "@/lib/format";
import { requireAdmin } from "@/lib/require-admin";
import {
  getSupabase,
  isSupabaseConfigured,
  missingSupabaseEnv,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = { title: "Деньги" };

// Строка отчёта: слева пояснение, справа сумма. Знак задаётся явно, потому что
// расход и приход в одной колонке иначе неразличимы.
function Row({ title, hint, value, sign = "", strong = false }) {
  return (
    <li className="flex items-baseline justify-between gap-4 p-3">
      <span className={strong ? "font-medium text-gray-800" : "text-gray-700"}>
        {title}
        {hint && <span className="block text-xs text-gray-400">{hint}</span>}
      </span>
      <span
        className={`shrink-0 tabular-nums ${
          strong ? "text-lg font-medium" : ""
        } ${sign === "−" ? "text-gray-500" : "text-gray-800"}`}
      >
        {sign}
        {formatMoney(value)}
      </span>
    </li>
  );
}

function Card({ title, note, children }) {
  return (
    <div className="space-y-2">
      <h2 className="font-medium">{title}</h2>
      {note && <p className="max-w-2xl text-sm text-gray-500">{note}</p>}
      <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white text-sm">
        {children}
      </ul>
    </div>
  );
}

export default async function AdminFinancePage() {
  await requireAdmin();

  if (!isSupabaseConfigured) {
    return (
      <section>
        <AdminHeader title="Деньги" backHref="/admin" backLabel="Админка" />
        <SetupNotice missing={missingSupabaseEnv()} />
      </section>
    );
  }

  const report = await financeReport(getSupabase());
  const who = (row) => row.profiles?.display_name || row.profiles?.email || "—";

  return (
    <section className="space-y-8">
      <AdminHeader title="Деньги" backHref="/admin" backLabel="Админка" />

      <Card
        title="Настоящие деньги"
        note="Деньги площадка получает в одном месте — когда человек перевёл вам на карту, а вы начислили ему баланс. Тратит — на нейросеть: каждая нарисованная карта стоит вам денег, в том числе бесплатная для посетителя."
      >
        <Row
          title="Получено пополнениями"
          hint="начисления из админки, кроме бонусов и правок"
          value={report.topups}
        />
        <Row
          title="Потрачено на нейросеть"
          hint={`${pluralGenerations(report.generationCount)} по ${formatMoney(report.generationCost)}`}
          value={report.spentOnNetwork}
          sign="−"
        />
        <Row title="Итого" value={report.realMoney} strong />
      </Card>

      <Card
        title="Внутренние баллы"
        note="Это не приход денег, а уменьшение долга перед авторами: вывести баллы нельзя, они ходят внутри сайта. Складывать их с пополнениями нельзя — получится прибыль, которой нет."
      >
        <Row
          title={`Комиссия с продаж — ${report.commissionPercent} %`}
          hint={`продано карт на ${formatMoney(report.purchases)}, авторам ушло ${formatMoney(report.sales)}`}
          value={report.commission}
        />
        <Row
          title="Генерации сверх бесплатных"
          hint="списано с балансов за платные генерации"
          value={report.paidGenerations}
        />
        <Row
          title="Выдано бонусами и правками"
          hint="стартовые бонусы при регистрации и ручные корректировки"
          value={report.corrections}
          sign={report.corrections < 0 ? "−" : ""}
        />
        <Row
          title="На руках у людей"
          hint="сумма всех балансов — столько баллов ещё могут потратить"
          value={report.owed}
          strong
        />
      </Card>

      <div className="space-y-2">
        <h2 className="font-medium">Кто пополнял</h2>
        {report.topupList.length === 0 ? (
          <p className="text-sm text-gray-500">
            Пополнений пока не было. Они появятся здесь, как только вы начислите
            кому-нибудь баланс в разделе «Пользователи».
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white text-sm">
            {report.topupList.map((row, index) => (
              <li key={index} className="flex items-baseline justify-between gap-4 p-3">
                <span className="text-gray-700">
                  {who(row)}
                  <span className="block text-xs text-gray-400">
                    {formatDate(row.created_at)}
                    {row.comment && ` · ${row.comment}`}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-green-700">
                  +{formatMoney(row.delta)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {report.correctionList.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-medium">Бонусы и правки</h2>
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white text-sm">
            {report.correctionList.map((row, index) => (
              <li key={index} className="flex items-baseline justify-between gap-4 p-3">
                <span className="text-gray-700">
                  {who(row)}
                  <span className="block text-xs text-gray-400">
                    {formatDate(row.created_at)}
                    {row.comment && ` · ${row.comment}`}
                  </span>
                </span>
                <span
                  className={`shrink-0 tabular-nums ${
                    row.delta < 0 ? "text-gray-500" : "text-gray-700"
                  }`}
                >
                  {row.delta > 0 ? "+" : "−"}
                  {formatMoney(Math.abs(row.delta))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
