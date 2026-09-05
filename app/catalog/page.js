import DeckCard from "@/components/DeckCard";
import SetupNotice from "@/components/SetupNotice";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

// Данные берутся из БД на каждый запрос — статическая генерация не нужна.
export const dynamic = "force-dynamic";

export const metadata = { title: "Каталог колод" };

export default async function CatalogPage() {
  if (!isSupabaseConfigured) {
    return (
      <section>
        <h1 className="mb-4 text-2xl font-semibold">Каталог готовых карт</h1>
        <SetupNotice />
      </section>
    );
  }

  const supabase = getSupabase();
  const { data: decks, error } = await supabase
    .from("decks")
    .select("id, title, description, price, cover_image, cards(count)")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold">Каталог готовых карт</h1>

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Не удалось загрузить каталог: {error.message}
        </p>
      )}

      {!error && (!decks || decks.length === 0) && (
        <p className="text-gray-500">
          Колод пока нет. Добавьте первую в админке.
        </p>
      )}

      {!error && decks && decks.length > 0 && (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              cardsCount={deck.cards?.[0]?.count ?? 0}
            />
          ))}
        </div>
      )}
    </section>
  );
}
