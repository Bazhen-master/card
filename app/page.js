import Link from "next/link";
import CardCarousel from "@/components/CardCarousel";
import { formatPrice } from "@/lib/format";
import { cardSrc, imageSrc } from "@/lib/storage";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

// На главной теперь показываются карты из базы — статической она быть не может.
export const dynamic = "force-dynamic";

// В карусель идёт всё, что открыто посетителю: карты из колод каталога и
// карты авторов, прошедшие проверку и выставленные в галерею. Черновики и
// карты «на проверке» сюда не попадают — они видны только своим авторам.
async function showcaseCards() {
  if (!isSupabaseConfigured) return [];

  const supabase = getSupabase();

  const [deckCards, galleryCards] = await Promise.all([
    supabase
      .from("cards")
      .select("id, image_url, text, deck_id, decks(title)")
      .not("deck_id", "is", null)
      .order("created_at", { ascending: false })
      // «Все, что в доступе»: витрина показывает весь каталог целиком. Потолок
      // в сотню — страховка на случай, когда карт станет очень много: тогда
      // понадобится подгрузка порциями, а не одна лента.
      .limit(100),
    supabase
      .from("cards")
      .select("id, image_url, preview_url, text, price")
      .eq("status", "listed")
      .order("listed_at", { ascending: false })
      .limit(40),
  ]);

  // Главная страница не должна падать из-за базы: не получилось — просто нет
  // карусели, кнопки и текст на месте. Причина уходит в лог хостинга.
  if (deckCards.error) {
    console.error("Карусель на главной не загрузилась:", deckCards.error.message);
  }
  if (galleryCards.error) {
    console.error("Карты галереи не загрузились:", galleryCards.error.message);
  }

  const fromDecks = (deckCards.data ?? []).map((card) => ({
    id: card.id,
    src: imageSrc(card.image_url),
    text: card.text,
    title: card.decks?.title,
    href: `/catalog/${card.deck_id}`,
  }));

  // У карт галереи показывается превью со знаком: оригинал — только автору и
  // покупателю.
  const fromGallery = (galleryCards.data ?? []).map((card) => ({
    id: card.id,
    src: cardSrc(card),
    text: card.text,
    title: formatPrice(card.price),
    href: `/gallery/${card.id}`,
  }));

  return [...fromDecks, ...fromGallery];
}

export default async function HomePage() {
  const cards = await showcaseCards();

  return (
    <div className="space-y-12">
      <section className="space-y-6 text-center">
        <h1 className="text-3xl font-bold">Метафорические ассоциативные карты</h1>
        <p className="mx-auto max-w-xl text-gray-600">
          Выберите готовую карту из каталога или сгенерируйте свою собственную
          с помощью нейросети.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/catalog"
            className="rounded-lg bg-accent px-5 py-2 text-white hover:opacity-90"
          >
            Смотреть каталог
          </Link>
          <Link
            href="/generate"
            className="rounded-lg border border-accent px-5 py-2 text-accent hover:bg-accent/10"
          >
            Сгенерировать карту
          </Link>
        </div>
      </section>

      {cards.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Карты сайта</h2>
            <Link href="/gallery" className="text-sm text-accent hover:underline">
              Галерея авторов
            </Link>
          </div>
          <CardCarousel items={cards} />
        </section>
      )}
    </div>
  );
}
