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
        <header className="border-b border-gray-200 bg-white">
          <nav className="max-w-4xl mx-auto flex items-center gap-6 px-4 py-4 text-sm">
            <Link href="/" className="font-semibold text-accent">
              Метафорические карты
            </Link>
            <Link href="/catalog" className="hover:text-accent">Каталог</Link>
            <Link href="/generate" className="hover:text-accent">Сгенерировать карту</Link>
            <Link href="/admin" className="ml-auto text-gray-400 hover:text-accent">Админка</Link>
          </nav>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
