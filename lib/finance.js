import { COMMISSION_PERCENT, GENERATION_COST } from "@/lib/balance";

// Отчёт для владелицы сайта: «сколько я заработала и от кого пришли деньги».
//
// Главная мысль отчёта — разделить две вещи, которые легко спутать:
//
// 1. Настоящие деньги. Их площадка получает ровно в одном месте — когда
//    человек перевёл на карту, а владелица начислила ему баланс из админки.
//    Тратит — на нейросеть, по себестоимости каждой генерации, включая
//    бесплатные: за них платит площадка.
// 2. Внутренние баллы. Комиссия с продаж и плата за генерации сверх лимита —
//    это не приход денег, а уменьшение долга перед авторами: вывести баллы
//    нельзя, они ходят внутри сайта. Складывать их с пополнениями нельзя,
//    иначе отчёт покажет прибыль, которой нет.
export async function financeReport(supabase) {
  const [entries, generations] = await Promise.all([
    supabase
      .from("balance_entries")
      .select("delta, kind, comment, created_at, profiles(email, display_name)")
      .order("created_at", { ascending: false }),
    supabase.from("generations").select("id", { count: "exact" }).limit(1),
  ]);

  if (entries.error) throw new Error(`Не удалось прочитать журнал: ${entries.error.message}`);

  const rows = entries.data ?? [];
  const sum = (test) => rows.filter(test).reduce((acc, row) => acc + row.delta, 0);

  const topups = sum((r) => r.kind === "topup");
  const sales = sum((r) => r.kind === "sale");
  const purchases = -sum((r) => r.kind === "purchase");
  const paidGenerations = -sum((r) => r.kind === "generation");
  const refunds = sum((r) => r.kind === "refund");
  const corrections = sum((r) => r.kind === "admin");

  // Комиссия не хранится отдельной строкой: она и есть разница между тем, что
  // списано у покупателя, и тем, что начислено автору.
  const commission = purchases - sales;

  const generationCount = generations.count ?? 0;
  const spentOnNetwork = generationCount * GENERATION_COST;

  // Обязательства перед людьми — сумма всех балансов: столько баллов сейчас на
  // руках и может быть потрачено внутри сайта.
  const owed = rows.reduce((acc, row) => acc + row.delta, 0);

  return {
    // настоящие деньги
    topups,
    spentOnNetwork,
    generationCount,
    realMoney: topups - spentOnNetwork,
    // внутренние баллы
    commission,
    paidGenerations,
    purchases,
    sales,
    corrections,
    refunds,
    owed,
    commissionPercent: COMMISSION_PERCENT,
    generationCost: GENERATION_COST,
    // кто пополнял: живые деньги, поимённо
    topupList: rows.filter((r) => r.kind === "topup" && r.delta > 0),
    // подарки и ручные правки — отдельно от денег
    correctionList: rows.filter((r) => r.kind === "admin"),
  };
}
