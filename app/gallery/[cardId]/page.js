import Link from "next/link";
import { notFound } from "next/navigation";
import { currentProfile } from "@/lib/account";
import { formatPrice } from "@/lib/format";
import { cardSrc } from "@/lib/storage";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  return { title: "Карта из галереи" };
}

export default async function GalleryCardPage({ params }) {
  if (!isSupabaseConfigured) notFound();

  const supabase = getSupabase();
  const { data: card } = await supabase
    .from("cards")
    .select("id, preview_url, image_url, text, price, status, owner_id, profiles(display_name)")
    .eq("id", params.cardId)
    .maybeSingle();

  // Страницы неопубликованной карты не существует ни для кого, кроме автора:
  // иначе по номеру можно было бы подсматривать чужие черновики.
  if (!card || card.status !== "listed") {
    const profile = await currentProfile();
    if (!card || !profile || card.owner_id !== profile.id) notFound();
  }

  const author = card.profiles?.display_name || "Автор";

  return (
    <section className="space-y-6">
      <Link href="/gallery" className="text-sm text-gray-500 hover:text-accent">
        ← В галерею
      </Link>

      <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-cardBg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cardSrc(card)}
            alt={card.text || "Метафорическая карта"}
            className="block w-full"
          />
        </div>

        <div className="space-y-4">
          {card.text && <p className="text-gray-700">{card.text}</p>}

          <p className="text-sm text-gray-500">Автор: {author}</p>

          <p className="text-2xl font-medium text-accent">
            {formatPrice(card.price)}
          </p>

          {card.status === "listed" ? (
            <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
              <p>
                Покупка появится вместе с внутренним балансом — это следующий
                шаг работы.
              </p>
              <p className="text-gray-400">
                После покупки карта откроется без водяного знака и в полном
                размере, её можно будет скачать.
              </p>
            </div>
          ) : (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Эта карта ещё не опубликована — её видите только вы.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
