import { getSupabase } from "@/lib/supabase";

// Комиссия площадки с продажи карты. 08.09.2026 заказчица подняла её с 30 до
// 40 %: автору при этом достаётся 60 %, и по её расчёту площадка зарабатывает
// в основном на генерациях, а не на перепродаже карт. Меняется переменной
// окружения, код для этого трогать не нужно — но если COMMISSION_PERCENT
// задана в панели хостинга, значение оттуда важнее этого.
export const COMMISSION_PERCENT = (() => {
  const value = Number(process.env.COMMISSION_PERCENT);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : 40;
})();

// Цена генерации сверх бесплатных пяти в сутки. 2 ₽ согласовано с заказчицей
// при себестоимости 0,50 ₽: генерация окупает и себя, и часть баллов,
// выплаченных авторам. Задаётся в рублях переменной окружения.
export const GENERATION_PRICE = (() => {
  const rubles = Number(process.env.GENERATION_PRICE);
  return Math.round((Number.isFinite(rubles) && rubles >= 0 ? rubles : 2) * 100);
})();

// Во что генерация обходится площадке. 0,50 ₽ за картинку у GenAPI (Flux
// Schnell), подтверждено настоящим списанием 07.09.2026. Нужна только для
// отчёта: на списания с посетителей не влияет, поэтому и живёт в переменной
// окружения — сменится поставщик, поменяется одна строка в панели хостинга.
export const GENERATION_COST = (() => {
  const rubles = Number(process.env.GENERATION_COST);
  return Math.round((Number.isFinite(rubles) && rubles >= 0 ? rubles : 0.5) * 100);
})();

// Остаток от деления отдаём автору, а не площадке: так у площадки не может
// незаметно набежать лишнее, а автор не теряет копейки на каждой продаже.
export function splitPrice(price) {
  const commission = Math.floor((price * COMMISSION_PERCENT) / 100);
  return { commission, author: price - commission };
}

// Баланс — это сумма журнала, отдельного числа «остаток» нет намеренно.
// Расхождение «на счету 12 ₽, а по операциям 9 ₽» так становится невозможным,
// и любой спор с автором разбирается по строкам.
export async function balanceOf(supabase, profileId) {
  const { data, error } = await supabase
    .from("balance_entries")
    .select("delta")
    .eq("profile_id", profileId);

  if (error) throw new Error(`Не удалось посчитать баланс: ${error.message}`);
  return (data ?? []).reduce((sum, row) => sum + row.delta, 0);
}

export async function addEntry(supabase, { profile, delta, kind, card = null, comment = null }) {
  const { data, error } = await supabase
    .from("balance_entries")
    .insert({ profile_id: profile, delta, kind, card_id: card, comment })
    .select("id")
    .single();

  if (error) throw new Error(`Не удалось записать операцию: ${error.message}`);
  return data.id;
}

export async function hasPurchased(supabase, profileId, cardId) {
  if (!profileId) return false;
  const { data } = await supabase
    .from("purchases")
    .select("id")
    .eq("buyer_id", profileId)
    .eq("card_id", cardId)
    .maybeSingle();
  return Boolean(data);
}

// Покупка карты за внутренние баллы.
//
// Настоящей транзакции здесь нет: сайт ходит в базу через REST, а не по SQL,
// и обернуть несколько запросов в BEGIN/COMMIT нельзя без отдельной функции в
// Postgres. Поэтому порядок выбран так, чтобы любая осечка была видна и
// откатывалась: сначала запись о покупке (её защищает уникальный индекс —
// дважды одну карту не купить), потом списание, потом перепроверка баланса, и
// только затем начисление автору. Уходить в минус посетитель не может: при
// отрицательном балансе списание и покупка удаляются.
export async function purchaseCard({ buyer, cardId }) {
  const supabase = getSupabase();

  const { data: card } = await supabase
    .from("cards")
    .select("id, price, status, owner_id, text")
    .eq("id", cardId)
    .maybeSingle();

  if (!card || card.status !== "listed") throw new Error("Эта карта не продаётся");
  if (card.owner_id === buyer.id) throw new Error("Это ваша карта — покупать её не нужно");
  if (!card.price || card.price <= 0) throw new Error("У карты не задана цена");

  if (await hasPurchased(supabase, buyer.id, card.id)) {
    throw new Error("Вы уже купили эту карту — она открыта в кабинете");
  }

  const balance = await balanceOf(supabase, buyer.id);
  if (balance < card.price) {
    throw new Error(
      "На балансе недостаточно средств. Пополнение пока делает владелица сайта — напишите ей."
    );
  }

  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .insert({ buyer_id: buyer.id, card_id: card.id, price: card.price })
    .select("id")
    .single();

  if (purchaseError) {
    // Уникальный индекс сработал — значит, кто-то нажал кнопку дважды.
    throw new Error("Эта карта уже куплена вами");
  }

  let debitId = null;
  try {
    debitId = await addEntry(supabase, {
      profile: buyer.id,
      delta: -card.price,
      kind: "purchase",
      card: card.id,
    });

    // Перепроверка после списания закрывает гонку двух одновременных покупок:
    // проверка «хватает ли» у обеих прошла бы, а вот минус увидит уже вторая.
    const after = await balanceOf(supabase, buyer.id);
    if (after < 0) throw new Error("На балансе недостаточно средств");
  } catch (error) {
    if (debitId) await supabase.from("balance_entries").delete().eq("id", debitId);
    await supabase.from("purchases").delete().eq("id", purchase.id);
    throw error;
  }

  if (card.owner_id) {
    const { author } = splitPrice(card.price);
    try {
      await addEntry(supabase, {
        profile: card.owner_id,
        delta: author,
        kind: "sale",
        card: card.id,
      });
    } catch (error) {
      // Деньги с покупателя списаны, автору не начислены. Откатывать покупку
      // здесь нельзя — карта уже открыта покупателю, поэтому громко пишем в
      // лог: такую строку начисляют руками из админки.
      console.error(
        `НАЧИСЛЕНИЕ АВТОРУ НЕ ПРОШЛО: карта ${card.id}, автор ${card.owner_id}, сумма ${author} коп. — ${error?.message}`
      );
    }
  }

  return card;
}
