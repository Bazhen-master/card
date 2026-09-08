import { formatPrice } from "@/lib/format";
import { cardSrc } from "@/lib/storage";

// По умолчанию плитка держит 3:4 и обрезает лишнее по краям: в каталоге колода
// должна выглядеть колодой, а не набором разных прямоугольников. Для только что
// сгенерированной карты это не годится — посетитель сам выбрал горизонтальный
// формат или квадрат и должен увидеть ровно то, что заказал; такой случай
// включается ratio="auto".
// src задаётся явно там, где показывается оригинал без знака: своя карта в
// кабинете и только что нарисованная. По умолчанию плитка берёт то, что можно
// показать любому, — превью с водяным знаком.
export default function CardTile({ card, showPrice = false, ratio = "3/4", src }) {
  const cropped = ratio !== "auto";

  // Подпись под картинкой: у карт авторов это название, у карт из колод —
  // текст, который написала владелица сайта. Названия у них нет, поэтому
  // порядок именно такой, и старые карты выглядят как раньше.
  const caption = card.title || card.text;

  return (
    <figure className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className={cropped ? "aspect-[3/4] bg-cardBg" : "bg-cardBg"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src || cardSrc(card)}
          alt={caption || "Метафорическая карта"}
          className={cropped ? "h-full w-full object-cover" : "block w-full"}
        />
      </div>
      {(caption || (showPrice && card.price)) && (
        <figcaption className="space-y-1 p-3 text-sm">
          {caption && <p className="text-gray-700">{caption}</p>}
          {showPrice && card.price ? (
            <p className="text-accent">{formatPrice(card.price)}</p>
          ) : null}
        </figcaption>
      )}
    </figure>
  );
}
