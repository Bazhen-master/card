// Проверка живости для хостинга и для диагностики. Ничего не читает из базы,
// поэтому отвечает 200 даже когда Supabase недоступен или переменные не заданы.
// Если этот адрес открывается, а сайт нет — проблема не в запуске приложения.
export const dynamic = "force-dynamic";

export function GET() {
  const memory = process.memoryUsage();

  return Response.json({
    status: "ok",
    port: process.env.PORT || "3000",
    // Сколько памяти занято прямо сейчас, в мегабайтах. rss — всё, что процесс
    // держит у системы; именно по этой цифре хостинг решает, убивать его или
    // нет. Если она подходит вплотную к лимиту тарифа, «зависания» сайта — это
    // перезапуски после убийства по памяти (в логе — голое «Killed»).
    memoryMb: {
      rss: Math.round(memory.rss / 1048576),
      heap: Math.round(memory.heapUsed / 1048576),
    },
    // Сколько минут приложение работает без перезапуска. Маленькое число на
    // сайте, который сегодня никто не выкладывал, означает, что его уронили.
    uptimeMin: Math.round(process.uptime() / 60),
    supabaseConfigured: Boolean(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD),
    time: new Date().toISOString(),
  });
}
