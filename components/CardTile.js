import { formatPrice } from "@/lib/format";

export default function CardTile({ card, showPrice = false }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="aspect-[3/4] bg-cardBg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.image_url}
          alt={card.text || "Метафорическая карта"}
          className="h-full w-full object-cover"
        />
      </div>
      {(card.text || (showPrice && card.price)) && (
        <figcaption className="space-y-1 p-3 text-sm">
          {card.text && <p className="text-gray-700">{card.text}</p>}
          {showPrice && card.price ? (
            <p className="text-accent">{formatPrice(card.price)}</p>
          ) : null}
        </figcaption>
      )}
    </figure>
  );
}
