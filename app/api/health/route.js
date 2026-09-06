// Проверка живости для хостинга и для диагностики. Ничего не читает из базы,
// поэтому отвечает 200 даже когда Supabase недоступен или переменные не заданы.
// Если этот адрес открывается, а сайт нет — проблема не в запуске приложения.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    port: process.env.PORT || "3000",
    supabaseConfigured: Boolean(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD),
    time: new Date().toISOString(),
  });
}
