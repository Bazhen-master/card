// Показывается, пока не заданы ключи Supabase: сайт остаётся рабочим,
// а страницы объясняют, чего не хватает, вместо ошибки.
export default function SetupNotice() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900 space-y-2">
      <p className="font-medium">База данных ещё не подключена</p>
      <p>
        Задайте переменные окружения <code>NEXT_PUBLIC_SUPABASE_URL</code> и{" "}
        <code>SUPABASE_SERVICE_ROLE_KEY</code> и выполните{" "}
        <code>supabase/schema.sql</code> в SQL-редакторе Supabase. Подробности — в
        README, раздел «Подключение Supabase».
      </p>
    </div>
  );
}
