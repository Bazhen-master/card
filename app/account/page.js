import Link from "next/link";
import { redirect } from "next/navigation";
import Banner from "@/components/Banner";
import CardTile from "@/components/CardTile";
import Field from "@/components/Field";
import SetupNotice from "@/components/SetupNotice";
import {
  logoutAction,
  changePriceAction,
  changeTitleAction,
  publishCardAction,
  saveNameAction,
  withdrawCardAction,
} from "./actions";
import { currentProfile } from "@/lib/account";
import { balanceOf } from "@/lib/balance";
import { MIN_CARD_PRICE, formatDate, formatMoney, formatPrice, toRubles } from "@/lib/format";
import { PER_SESSION_PER_DAY, freePeriodEnd } from "@/lib/generation-limit";
import { cardTitleReady, readSettings, withTitle } from "@/lib/settings";
import { originalSrc } from "@/lib/storage";
import {
  getSupabase,
  isSupabaseConfigured,
  missingSupabaseEnv,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = { title: "Мой кабинет" };

export default async function AccountPage({ searchParams }) {
  if (!isSupabaseConfigured) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Мой кабинет</h1>
        <SetupNotice missing={missingSupabaseEnv()} />
      </section>
    );
  }

  const profile = await currentProfile();
  // Проверка именно здесь, а не только в middleware: до страницы с чужими
  // данными подделанный заголовок дотянуться не должен.
  if (!profile) redirect("/login?from=%2Faccount");

  const supabase = getSupabase();
  // Название показываем и даём править, только когда колонка в базе уже есть.
  const titleReady = await cardTitleReady(supabase);

  const { data: cards } = await supabase
    .from("cards")
    .select(withTitle("id, image_url, preview_url, text, price, status, reject_reason", titleReady))
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  const mine = cards ?? [];

  const balance = await balanceOf(supabase, profile.id);

  const { data: entries } = await supabase
    .from("balance_entries")
    .select("id, delta, kind, comment, created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: purchases } = await supabase
    .from("purchases")
    .select("id, price, created_at, cards(id, image_url, preview_url, text)")
    .eq("buyer_id", profile.id)
    .order("created_at", { ascending: false });

  const bought = (purchases ?? []).filter((row) => row.cards);

  // Докуда действуют бесплатные генерации. Дату регистрации в профиле сессии
  // нет — берём отдельным запросом, он же самый дешёвый в этой странице.
  const { free_period_days: freeDays } = await readSettings(supabase);
  const { data: registered } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", profile.id)
    .maybeSingle();

  const periodEnd = freePeriodEnd(
    registered?.created_at ? new Date(registered.created_at) : null,
    freeDays
  );
  const periodOver = Boolean(periodEnd && periodEnd.getTime() <= Date.now());

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Мой кабинет</h1>
          <p className="text-sm text-gray-500">{profile.email}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-accent hover:text-accent"
          >
            Выйти
          </button>
        </form>
      </div>

      <Banner ok={searchParams?.ok} error={searchParams?.error} />

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">Баланс</p>
        <p className="text-2xl font-medium text-accent">{formatMoney(balance)}</p>
        <p className="mt-1 text-xs text-gray-400">
          Баллы тратятся на карты из галереи и на генерации сверх бесплатных.
          Пополнение пока делает владелица сайта вручную — напишите ей. Продали
          свою карту — деньги придут сюда.
        </p>
        {periodEnd && (
          <p className="mt-2 text-xs text-gray-500">
            {periodOver ? (
              <>
                Бесплатный период закончился — новые карты рисуются за баллы.
              </>
            ) : (
              <>
                Бесплатно: {PER_SESSION_PER_DAY} карт в сутки до{" "}
                {formatDate(periodEnd)}, дальше — за баллы.
              </>
            )}
          </p>
        )}
      </div>

      <form
        action={saveNameAction}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4"
      >
        <div className="min-w-[14rem] flex-1">
          <Field
            label="Имя автора"
            hint="Оно стоит под вашими картами в галерее. Почту посетители не видят."
          >
            <input
              name="display_name"
              maxLength={40}
              defaultValue={profile.display_name ?? ""}
              placeholder="Например: Мария"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </Field>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-accent px-4 py-2 text-sm text-accent hover:bg-accent/10"
        >
          Сохранить
        </button>
      </form>

      {bought.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium">Купленные карты</h2>
          <div className="grid grid-cols-2 items-start gap-4 sm:grid-cols-4">
            {bought.map((row) => (
              <div key={row.id} className="space-y-1">
                <CardTile
                  card={row.cards}
                  ratio="auto"
                  src={originalSrc(row.cards)}
                />
                <a
                  href={`/api/original/${row.cards.id}?download`}
                  className="block text-center text-xs text-gray-500 hover:text-accent"
                >
                  Скачать оригинал
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {(entries ?? []).length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium">Операции</h2>
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white text-sm">
            {(entries ?? []).map((entry) => (
              <li key={entry.id} className="flex items-baseline justify-between gap-4 p-3">
                <span className="text-gray-700">
                  {KINDS[entry.kind] || entry.kind}
                  {entry.comment && (
                    <span className="text-gray-400"> · {entry.comment}</span>
                  )}
                </span>
                <span
                  className={
                    entry.delta < 0 ? "shrink-0 text-gray-500" : "shrink-0 text-green-700"
                  }
                >
                  {entry.delta > 0 ? "+" : "−"}
                  {formatMoney(Math.abs(entry.delta))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-medium">Мои карты</h2>
          <Link href="/generate" className="text-sm text-accent hover:underline">
            Сгенерировать ещё
          </Link>
        </div>

        {mine.length === 0 ? (
          <p className="text-sm text-gray-500">
            Пока пусто.{" "}
            <Link href="/generate" className="text-accent hover:underline">
              Нарисуйте первую карту
            </Link>{" "}
            — она сохранится здесь.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {mine.map((card) => (
              <li
                key={card.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row"
              >
                <div className="w-32 shrink-0">
                  <CardTile card={card} ratio="auto" src={originalSrc(card)} />
                </div>
                <div className="flex-1 space-y-3 text-sm">
                  {titleReady && <TitleForm card={card} />}
                  {/* Свой запрос к нейросети автор видит всегда: чужим он не
                      показывается, но переспросить «а что я тогда написала»
                      человек должен уметь. Раньше он стоял подписью под
                      картинкой — с появлением названия там теперь название. */}
                  {card.text && (
                    <p className="text-xs text-gray-400">Запрос: {card.text}</p>
                  )}
                  <CardStatus card={card} />
                  <a
                    href={`/api/original/${card.id}?download`}
                    className="inline-block text-xs text-gray-500 hover:text-accent"
                  >
                    Скачать оригинал
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

const KINDS = {
  topup: "Пополнение",
  purchase: "Покупка карты",
  sale: "Продажа карты",
  generation: "Генерация карты",
  refund: "Возврат",
  admin: "Корректировка",
};

// Что можно сделать с картой, зависит от того, где она сейчас в пути
// «кабинет → проверка → галерея».
function CardStatus({ card }) {
  if (card.status === "pending") {
    return (
      <div className="space-y-2">
        <p className="text-amber-700">На проверке — обычно это недолго.</p>
        <PriceForm card={card} />
        <WithdrawButton card={card} label="Отозвать" />
      </div>
    );
  }

  if (card.status === "listed") {
    return (
      <div className="space-y-2">
        <p className="text-green-700">
          В галерее ·{" "}
          <Link href={`/gallery/${card.id}`} className="underline">
            посмотреть
          </Link>
        </p>
        <PriceForm card={card} />
        <WithdrawButton card={card} label="Убрать из галереи" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {card.status === "rejected" && (
        <p className="text-red-700">
          Отклонено: {card.reject_reason || "без объяснения"}. Поправьте цену
          или выложите другую карту.
        </p>
      )}

      {card.preview_url ? (
        <form action={publishCardAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="card" value={card.id} />
          <label className="text-xs text-gray-500">
            Цена, ₽
            <input
              name="price"
              type="number"
              min={toRubles(MIN_CARD_PRICE)}
              step="0.1"
              defaultValue={card.price ? toRubles(card.price) : toRubles(MIN_CARD_PRICE)}
              className="mt-1 block w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Выставить в галерею
          </button>
          <span className="w-full text-xs text-gray-400">
            Минимум {formatPrice(MIN_CARD_PRICE)}. Карта появится в галерее
            после проверки, с водяным знаком; покупатель получит её без знака.
          </span>
        </form>
      ) : (
        <p className="text-gray-500">
          Эту карту в галерею выставить нельзя: у неё нет превью с водяным
          знаком.
        </p>
      )}
    </div>
  );
}

// Название карты — то, под чем её видят в галерее. Меняется в любом статусе:
// придумать удачное с первого раза выходит не всегда.
function TitleForm({ card }) {
  return (
    <form action={changeTitleAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="card" value={card.id} />
      <label className="min-w-[10rem] flex-1 text-xs text-gray-500">
        Название
        <input
          name="title"
          maxLength={60}
          defaultValue={card.title ?? ""}
          placeholder="без названия"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
        />
      </label>
      <button
        type="submit"
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-accent hover:text-accent"
      >
        Сохранить
      </button>
    </form>
  );
}

// Цену выставленной карты можно поправить, не снимая её с витрины: проверку
// проходит картинка, а не ценник. Карта остаётся там же, где была.
function PriceForm({ card }) {
  return (
    <form action={changePriceAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="card" value={card.id} />
      <label className="text-xs text-gray-500">
        Цена, ₽
        <input
          name="price"
          type="number"
          min={toRubles(MIN_CARD_PRICE)}
          step="0.1"
          defaultValue={toRubles(card.price ?? MIN_CARD_PRICE)}
          className="mt-1 block w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
        />
      </label>
      <button
        type="submit"
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-accent hover:text-accent"
      >
        Изменить цену
      </button>
      <span className="w-full text-xs text-gray-400">
        Сейчас {formatPrice(card.price)}. Новая цена встаёт сразу, повторной
        проверки не требует; уже купленные карты остаются по старой цене.
      </span>
    </form>
  );
}

function WithdrawButton({ card, label }) {
  return (
    <form action={withdrawCardAction}>
      <input type="hidden" name="card" value={card.id} />
      <button
        type="submit"
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:border-accent hover:text-accent"
      >
        {label}
      </button>
    </form>
  );
}
