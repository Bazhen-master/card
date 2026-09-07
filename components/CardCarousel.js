"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Лента карт с горизонтальной прокруткой. Готовой библиотеки нет намеренно:
// на телефоне лента листается пальцем средствами самого браузера, а на
// компьютере — стрелками по краям. Так карусель работает даже до загрузки
// скрипта и не тянет в проект лишнюю зависимость.
export default function CardCarousel({ items }) {
  const track = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  // Стрелка на краю ленты бесполезна и сбивает с толку — прячем её.
  function refresh() {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 8);
    setAtEnd(el.scrollLeft >= max - 8);
  }

  useEffect(() => {
    refresh();
    // Ширина ленты меняется при повороте телефона и при изменении окна.
    window.addEventListener("resize", refresh);
    return () => window.removeEventListener("resize", refresh);
  }, [items]);

  function scroll(direction) {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  if (!items || items.length === 0) return null;

  return (
    <div className="relative">
      <ul
        ref={track}
        onScroll={refresh}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <li key={item.id} className="w-40 shrink-0 snap-start sm:w-48">
            <Link
              href={item.href}
              className="group block overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-accent hover:shadow-sm"
            >
              <div className="aspect-[3/4] bg-cardBg">
                {/* Обычный img, как и на остальных страницах: картинки идут
                    через наш /api/image, оптимизатор Next тут не нужен. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.src}
                  alt={item.text || item.title || "Метафорическая карта"}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-0.5 p-3 text-sm">
                {item.title && (
                  <p className="font-medium text-gray-700 group-hover:text-accent">
                    {item.title}
                  </p>
                )}
                {item.text && (
                  <p className="line-clamp-2 text-gray-500">{item.text}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {!atStart && (
        <Arrow direction={-1} onClick={() => scroll(-1)} label="Предыдущие карты" />
      )}
      {!atEnd && (
        <Arrow direction={1} onClick={() => scroll(1)} label="Следующие карты" />
      )}
    </div>
  );
}

function Arrow({ direction, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 hidden -translate-y-1/2 rounded-full border border-gray-200 bg-white/90 p-2 text-gray-600 shadow-sm transition hover:text-accent sm:block ${
        direction < 0 ? "-left-4" : "-right-4"
      }`}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
        <path d={direction < 0 ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
