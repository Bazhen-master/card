import { formatPrice } from "@/lib/format";
import { imageSrc } from "@/lib/storage";

// По умолчанию плитка держит 3:4 и обрезает лишнее по краям: в каталоге колода
// должна выглядеть колодой, а не набором разных прямоугольников. Для только что
// сгенерированной карты это не годится — посетитель сам выбрал горизонтальный
// формат или квадрат и должен увидеть ровно то, что заказал; такой случай
// включается ratio="auto".
export default function CardTile({ card, showPrice = false, ratio = "3/4" }) {
  const cropped = ratio !== "auto";

  return (
    <figure className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className={cropped ? "aspect-[3/4] bg-cardBg" : "bg-cardBg"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc(card.image_url)}
          alt={card.text || "Метафорическая карта"}
          className={cropped ? "h-full w-full object-cover" : "block w-full"}
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
