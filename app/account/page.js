import Link from "next/link";
import { redirect } from "next/navigation";
import Banner from "@/components/Banner";
import CardTile from "@/components/CardTile";
import Field from "@/components/Field";
import SetupNotice from "@/components/SetupNotice";
import {
  logoutAction,
  publishCardAction,
  saveNameAction,
  withdrawCardAction,
} from "./actions";
import { currentProfile } from "@/lib/account";
import { MIN_CARD_PRICE, formatPrice, toRubles } from "@/lib/format";
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
  const { data: cards } = await supabase
    .from("cards")
    .select("id, image_url, preview_url, text, price, status, reject_reason")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  const mine = cards ?? [];

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

// Что можно сделать с картой, зависит от того, где она сейчас в пути
// «кабинет → проверка → галерея».
function CardStatus({ card }) {
  if (card.status === "pending") {
    return (
      <div className="space-y-2">
        <p className="text-amber-700">На проверке — обычно это недолго.</p>
        <p className="text-gray-500">Цена: {formatPrice(card.price)}</p>
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
        <p className="text-gray-500">Цена: {formatPrice(card.price)}</p>
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
