import Link from "next/link";
import { notFound } from "next/navigation";
import CardTile from "@/components/CardTile";
import SetupNotice from "@/components/SetupNotice";
import { formatPrice, pluralCards } from "@/lib/format";
import { imageSrc } from "@/lib/storage";
import {
  getSupabase,
  isSupabaseConfigured,
  missingSupabaseEnv,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function DeckPage({ params }) {
  if (!isSupabaseConfigured) {
    return <SetupNotice missing={missingSupabaseEnv()} />;
  }

  const supabase = getSupabase();
  const { data: deck, error } = await supabase
    .from("decks")
    .select("id, title, description, price, cover_image")
    .eq("id", params.deckId)
    .maybeSingle();

  // Несуществующий или некорректный id — обычная 404, а не ошибка сервера.
  if (error || !deck) notFound();

  const { data: cards } = await supabase
    .from("cards")
    .select("id, image_url, text, price")
    .eq("deck_id", deck.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const list = cards ?? [];

  return (
    <article className="space-y-8">
      <Link href="/catalog" className="text-sm text-gray-500 hover:text-accent">
        ← Каталог
      </Link>

      <header className="flex flex-col gap-6 sm:flex-row">
        <div className="w-full shrink-0 overflow-hidden rounded-xl bg-cardBg sm:w-56">
          {deck.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc(deck.cover_image)}
              alt={deck.title}
              className="aspect-[3/4] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center text-sm text-gray-400">
              без обложки
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-semibold">{deck.title}</h1>
          {deck.description && <p className="text-gray-600">{deck.description}</p>}
          <p className="text-sm text-gray-400">{pluralCards(list.length)}</p>
          <p className="text-xl font-medium text-accent">{formatPrice(deck.price)}</p>

          {/* Заглушка: рабочая кнопка со сбором заявок появится на Этапе 4. */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg bg-accent px-5 py-2 text-white opacity-50"
            >
              Купить колоду
            </button>
            <p className="text-xs text-gray-400">
              Оформление заказа появится на следующем этапе.
            </p>
          </div>
        </div>
      </header>

      <section>
        <h2 className="mb-4 text-lg font-medium">Карты в колоде</h2>
        {list.length === 0 ? (
          <p className="text-gray-500">В этой колоде пока нет карт.</p>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            {list.map((card) => (
              <CardTile key={card.id} card={card} />
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
