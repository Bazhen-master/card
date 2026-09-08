import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: {
    default: "Метафорические карты",
    template: "%s — Метафорические карты",
  },
  description: "Сервис готовых и генерируемых метафорических карт",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        {/* На узком экране шапка переносится в две строки, а не сжимается в
            нечитаемую полоску: в 360 точек все пункты не помещаются
            никак. «Сгенерировать карту» на телефоне сокращается до «Создать» —
            это самая длинная надпись, и именно она ломала строку.

            Ссылки на админку здесь нет намеренно: посетителю она не нужна, а
            владелица заходит по прямому адресу /admin. На доступ это не
            влияет — /admin/* закрыт паролём в middleware, ссылка лишь
            показывала посторонним, что админка вообще есть. */}
        <header className="border-b border-gray-200 bg-white">
          <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm sm:gap-x-6 sm:py-4">
            <Link href="/" className="font-semibold text-accent">
              Метафорические карты
            </Link>
            <Link href="/catalog" className="hover:text-accent">Каталог</Link>
            <Link href="/gallery" className="hover:text-accent">Галерея</Link>
            <Link href="/generate" className="hover:text-accent">
              <span className="sm:hidden">Создать</span>
              <span className="hidden sm:inline">Сгенерировать карту</span>
            </Link>
            <Link href="/account" className="hover:text-accent sm:ml-auto">Кабинет</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">{children}</main>
      </body>
    </html>
  );
}
