import Link from "next/link";
import { formatPrice } from "@/lib/format";

// Общая галерея: плитки укладываются в колонки, как в галереях картинок.
// Колонки сделаны на CSS columns, а не на сетке: карты бывают вертикальные,
// горизонтальные и квадратные, и колонки укладывают их без пустот и без
// обрезки — каждая карта видна целиком, в своей пропорции.
//
// Подпись (автор и цена) всплывает при наведении. Условие — не ширина экрана,
// а наличие мыши: планшет шириной 820 точек прошёл бы по ширине как «большой
// экран», и цена на нём не показалась бы никогда. Где мыши нет, подпись видна
// сразу.
export default function CardGallery({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="group relative mb-3 block break-inside-avoid overflow-hidden rounded-xl border border-gray-200 bg-cardBg sm:mb-4"
        >
          {/* Обычный img, как и везде: картинки идут через наш /api/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.src}
            alt={item.text || item.title || "Метафорическая карта"}
            loading="lazy"
            className="block w-full transition duration-300 group-hover:scale-[1.02]"
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/45 to-transparent px-3 pb-2 pt-8 text-white transition duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
            <p className="truncate text-xs sm:text-sm">{item.title}</p>
            {item.price !== null && item.price !== undefined && (
              <p className="text-sm font-medium">
                {formatPrice(item.price)}
                {item.note && (
                  <span className="font-normal text-white/70"> · {item.note}</span>
                )}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
