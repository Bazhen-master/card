import Link from "next/link";

export default function HomePage() {
  return (
    <section className="text-center space-y-6">
      <h1 className="text-3xl font-bold">Метафорические ассоциативные карты</h1>
      <p className="text-gray-600 max-w-xl mx-auto">
        Выберите готовую карту из каталога или сгенерируйте свою собственную
        с помощью нейросети.
      </p>
      <div className="flex justify-center gap-4">
        <Link
          href="/catalog"
          className="px-5 py-2 rounded-lg bg-accent text-white hover:opacity-90"
        >
          Смотреть каталог
        </Link>
        <Link
          href="/generate"
          className="px-5 py-2 rounded-lg border border-accent text-accent hover:bg-accent/10"
        >
          Сгенерировать карту
        </Link>
      </div>
    </section>
  );
}
