import Link from "next/link";
import { notFound } from "next/navigation";
import SubmitButton from "@/components/SubmitButton";
import { buyCardAction } from "../actions";
import { currentProfile } from "@/lib/account";
import { balanceOf, hasPurchased } from "@/lib/balance";
import { formatMoney, formatPrice } from "@/lib/format";
import { cardTitleReady, withTitle } from "@/lib/settings";
import { cardSrc, originalSrc } from "@/lib/storage";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = { title: "Карта из галереи" };

export default async function GalleryCardPage({ params, searchParams }) {
  if (!isSupabaseConfigured) notFound();

  const supabase = getSupabase();
  const titleReady = await cardTitleReady(supabase);
  const { data: card } = await supabase
    .from("cards")
    .select(
      withTitle(
        "id, preview_url, image_url, text, price, status, owner_id, profiles(display_name)",
        titleReady
      )
    )
    .eq("id", params.cardId)
    .maybeSingle();

  const profile = await currentProfile();

  // Страницы неопубликованной карты не существует ни для кого, кроме автора:
  // иначе по номеру можно было бы подсматривать чужие черновики.
  if (!card || card.status !== "listed") {
    if (!card || !profile || card.owner_id !== profile.id) notFound();
  }

  const author = card.profiles?.display_name || "Автор";
  const mine = profile && card.owner_id === profile.id;
  const bought = profile ? await hasPurchased(supabase, profile.id, card.id) : false;
  const balance = profile ? await balanceOf(supabase, profile.id) : 0;

  // Владелец и покупатель смотрят оригинал, остальные — превью со знаком.
  const src = mine || bought ? originalSrc(card) : cardSrc(card);

  // Описание — это запрос, по которому карта нарисована. Его видит автор (и в
  // модерации — владелица сайта), но не посетитель галереи: иначе карту не
  // покупают, а повторяют по готовому рецепту. Покупателю запрос тоже не
  // показываем — он купил картинку, а не способ печатать такие же.
  const ownText = mine ? card.text : null;

  return (
    <section className="space-y-6">
      <Link href="/gallery" className="text-sm text-gray-500 hover:text-accent">
        ← В галерею
      </Link>

      {searchParams?.error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {searchParams.error}
        </p>
      )}
      {searchParams?.bought && (
        <p className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          Карта куплена — она открылась без водяного знака, её можно скачать.
        </p>
      )}

      <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-cardBg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={card.title || "Метафорическая карта"}
            className="block w-full"
          />
        </div>

        <div className="space-y-4">
          <h1 className="text-xl font-semibold">{card.title || "Без названия"}</h1>

          {ownText && <p className="text-gray-700">{ownText}</p>}

          <p className="text-sm text-gray-500">Автор: {author}</p>

          <p className="text-2xl font-medium text-accent">{formatPrice(card.price)}</p>

          {card.status !== "listed" ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Эта карта ещё не опубликована — её видите только вы.
            </p>
          ) : bought || mine ? (
            <div className="space-y-2">
              <p className="text-sm text-green-700">
                {mine ? "Это ваша карта." : "Куплено."} Открыта без водяного знака.
              </p>
              <a
                href={`/api/original/${card.id}?download`}
                className="inline-block rounded-lg border border-accent px-4 py-2 text-sm text-accent hover:bg-accent/10"
              >
                Скачать оригинал
              </a>
            </div>
          ) : profile ? (
            <form action={buyCardAction} className="space-y-2">
              <input type="hidden" name="card" value={card.id} />
              <SubmitButton pendingLabel="Покупаю…" className="w-full">
                Купить за {formatPrice(card.price)}
              </SubmitButton>
              <p className="text-xs text-gray-400">
                На балансе: {formatMoney(balance)}. Списывается с баланса, карта
                сразу открывается без знака и в полном размере.
              </p>
            </form>
          ) : (
            <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
              <p>
                <Link
                  href={`/login?from=${encodeURIComponent(`/gallery/${card.id}`)}`}
                  className="text-accent hover:underline"
                >
                  Войдите
                </Link>
                , чтобы купить карту.
              </p>
              <p className="text-gray-400">
                После покупки карта открывается без водяного знака и в полном
                размере, её можно скачать.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
