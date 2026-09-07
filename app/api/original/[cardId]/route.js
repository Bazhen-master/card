import { cookies } from "next/headers";
import { currentProfile } from "@/lib/account";
import { ADMIN_COOKIE, sessionToken } from "@/lib/auth";
import { readSessionId } from "@/lib/generation-limit";
import { downloadCardImage } from "@/lib/storage";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function isAdmin() {
  const expected = await sessionToken();
  const actual = cookies().get(ADMIN_COOKIE)?.value;
  return Boolean(expected && actual === expected);
}

// Кто вправе увидеть оригинал без водяного знака.
async function maySee(supabase, card) {
  // Карты из колод каталога и так открыты всем — они лежат в публичном бакете
  // и показываются на витрине.
  if (card.deck_id) return true;

  const profile = await currentProfile();
  if (profile && card.owner_id === profile.id) return true;

  // Гость без учётной записи: карта его, если она нарисована в его сессии.
  const session = readSessionId();
  if (session && !card.owner_id) {
    const { data } = await supabase
      .from("generations")
      .select("id")
      .eq("card_id", card.id)
      .eq("session_id", session)
      .limit(1);
    if (data && data.length > 0) return true;
  }

  // Покупатели добавятся здесь на Этапе 6.4, когда появится таблица purchases.
  return isAdmin();
}

// Оригинал карты. В отличие от /api/image/, где имя файла — сам пропуск,
// здесь пропуск проверяется: файл лежит в закрытом бакете, публичной ссылки
// на него нет вообще.
export async function GET(request, { params }) {
  const id = params.cardId ?? "";
  if (!UUID.test(id)) return new Response("Недопустимый номер карты", { status: 400 });

  if (!isSupabaseConfigured) return new Response("Supabase не настроен", { status: 503 });

  const supabase = getSupabase();
  const { data: card, error } = await supabase
    .from("cards")
    .select("id, image_url, owner_id, deck_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !card) return new Response("Карта не найдена", { status: 404 });

  if (!(await maySee(supabase, card))) {
    return new Response("Эта карта доступна только с водяным знаком", { status: 403 });
  }

  const { data, error: fileError } = await downloadCardImage(supabase, card.image_url);
  if (fileError || !data) return new Response("Картинка не найдена", { status: 404 });

  const download = new URL(request.url).searchParams.has("download");
  const type = data.type || "image/png";
  const extension = type.includes("jpeg") ? "jpg" : type.split("/")[1] || "png";

  return new Response(data, {
    headers: {
      "Content-Type": type,
      // Ответ зависит от того, кто спрашивает, поэтому его нельзя складывать
      // в общий кэш прокси — только в браузере того же посетителя.
      "Cache-Control": "private, max-age=600",
      ...(download
        ? { "Content-Disposition": `attachment; filename="card-${card.id}.${extension}"` }
        : {}),
    },
  });
}
