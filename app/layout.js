import "./globals.css";

export const metadata = {
  title: "Метафорические карты",
  description: "Сервис готовых и генерируемых метафорических карт",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <header className="border-b border-gray-200 bg-white">
          <nav className="max-w-4xl mx-auto flex items-center gap-6 px-4 py-4 text-sm">
            <a href="/" className="font-semibold text-accent">
              Метафорические карты
            </a>
            <a href="/catalog" className="hover:text-accent">Каталог</a>
            <a href="/generate" className="hover:text-accent">Сгенерировать карту</a>
            <a href="/admin" className="ml-auto text-gray-400 hover:text-accent">Админка</a>
          </nav>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
