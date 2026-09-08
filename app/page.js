import Link from "next/link";
import CardGallery from "@/components/CardGallery";
import { cardSrc, imageSrc } from "@/lib/storage";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

// На главной показываются карты из базы — статической она быть не может.
export const dynamic = "force-dynamic";

// В галерею на главной идёт всё, что открыто посетителю: карты из колод
// каталога и карты авторов, прошедшие проверку. Черновики и карты «на
// проверке» сюда не попадают — они видны только своим авторам.
async function showcaseCards() {
  if (!isSupabaseConfigured) return [];

  const supabase = getSupabase();

  const [deckCards, galleryCards] = await Promise.all([
    supabase
      .from("cards")
      .select("id, image_url, text, price, deck_id, decks(title, price)")
      .not("deck_id", "is", null)
      .order("created_at", { ascending: false })
      // «Все, что в доступе»: витрина показывает весь каталог целиком. Потолок
      // в сотню — страховка на случай, когда карт станет очень много: тогда
      // понадобится подгрузка порциями, а не одна страница.
      .limit(100),
    supabase
      .from("cards")
      .select("id, image_url, preview_url, price, profiles(display_name)")
      .eq("status", "listed")
      .order("listed_at", { ascending: false })
      .limit(40),
  ]);

  // Главная страница не должна падать из-за базы: не получилось — просто нет
  // галереи, кнопки и текст на месте. Причина уходит в лог хостинга.
  if (deckCards.error) {
    console.error("Галерея на главной не загрузилась:", deckCards.error.message);
  }
  if (galleryCards.error) {
    console.error("Карты авторов не загрузились:", galleryCards.error.message);
  }

  // У карт колоды «автор» — сама колода. Цена показывается своя, если карта
  // продаётся поштучно, иначе цена колоды с пометкой.
  const fromDecks = (deckCards.data ?? []).map((card) => ({
    id: card.id,
    src: imageSrc(card.image_url),
    text: card.text,
    title: card.decks?.title ?? "Колода",
    price: card.price ?? card.decks?.price ?? null,
    note: card.price ? null : "вся колода",
    href: `/catalog/${card.deck_id}`,
  }));

  // У карт галереи показывается превью со знаком: оригинал — только автору и
  // покупателю. Описание такой карты (оно же запрос к нейросети) не выводится
  // и не подставляется в alt: иначе чужой запрос копируется одним движением.
  // У карт колод текст свой, подпись от владелицы сайта, — он остаётся.
  const fromGallery = (galleryCards.data ?? []).map((card) => ({
    id: card.id,
    src: cardSrc(card),
    title: card.profiles?.display_name || "Автор",
    price: card.price,
    note: null,
    href: `/gallery/${card.id}`,
  }));

  // Карты авторов впереди: витрина живее, когда сверху то, что появилось
  // последним, а каталог никуда не денется.
  return [...fromGallery, ...fromDecks];
}

export default async function HomePage() {
  const cards = await showcaseCards();

  return (
    <div className="space-y-8 sm:space-y-12">
      <section className="space-y-5 text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">
          Метафорические ассоциативные карты
        </h1>
        <p className="mx-auto max-w-xl text-gray-600">
          Выберите готовую карту из каталога или сгенерируйте свою собственную
          с помощью нейросети.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/catalog"
            className="rounded-lg bg-accent px-5 py-2.5 text-white hover:opacity-90"
          >
            Смотреть каталог
          </Link>
          <Link
            href="/generate"
            className="rounded-lg border border-accent px-5 py-2.5 text-accent hover:bg-accent/10"
          >
            Сгенерировать карту
          </Link>
        </div>
      </section>

      {cards.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold sm:text-xl">Карты сайта</h2>
            <Link href="/gallery" className="shrink-0 text-sm text-accent hover:underline">
              Галерея авторов
            </Link>
          </div>
          <CardGallery items={cards} />
        </section>
      )}
    </div>
  );
}
