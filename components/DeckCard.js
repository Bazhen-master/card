import Link from "next/link";
import { formatPrice, pluralCards } from "@/lib/format";

export default function DeckCard({ deck, cardsCount }) {
  return (
    <Link
      href={`/catalog/${deck.id}`}
      className="group block overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-accent hover:shadow-sm"
    >
      <div className="aspect-[3/4] bg-cardBg">
        {deck.cover_image ? (
          // Обычный img, а не next/image: домен Storage задаётся переменной
          // окружения и заранее не известен для remotePatterns.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deck.cover_image}
            alt={deck.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            без обложки
          </div>
        )}
      </div>
      <div className="space-y-1 p-4">
        <h2 className="font-medium group-hover:text-accent">{deck.title}</h2>
        {deck.description && (
          <p className="line-clamp-2 text-sm text-gray-500">{deck.description}</p>
        )}
        <div className="flex items-center justify-between pt-1 text-sm">
          <span className="font-medium text-accent">{formatPrice(deck.price)}</span>
          <span className="text-gray-400">{pluralCards(cardsCount)}</span>
        </div>
      </div>
    </Link>
  );
}
