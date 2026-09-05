// Показывается, пока не заданы ключи Supabase: сайт остаётся рабочим,
// а страница называет конкретные незаданные переменные — так сразу видно,
// что именно не доехало до хостинга.
export default function SetupNotice({ missing = [] }) {
  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900">
      <p className="font-medium">База данных ещё не подключена</p>

      {missing.length > 0 && (
        <div>
          <p>Не заданы переменные окружения:</p>
          <ul className="mt-1 list-disc pl-5">
            {missing.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p>
        Добавьте их в разделе Environment на хостинге (или в файл{" "}
        <code>.env.local</code> при локальном запуске) и выполните{" "}
        <code>supabase/schema.sql</code> в SQL-редакторе Supabase. Подробности — в
        README, раздел «Подключение Supabase».
      </p>
    </div>
  );
}
