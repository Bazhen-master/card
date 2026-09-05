import { CARDS_BUCKET, getSupabase, isSupabaseConfigured } from "@/lib/supabase";

// Имена объектов создаёт uploadImage: crypto.randomUUID() плюс расширение.
// Всё, что на такое имя не похоже, отклоняем — чтобы через параметр пути
// нельзя было выйти за пределы бакета.
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

// Отдаёт картинку из Supabase Storage через наш домен — см. imageSrc().
export async function GET(_request, { params }) {
  const name = decodeURIComponent(params.name ?? "");

  if (!SAFE_NAME.test(name) || name.includes("..")) {
    return new Response("Недопустимое имя файла", { status: 400 });
  }

  if (!isSupabaseConfigured) {
    return new Response("Supabase не настроен", { status: 503 });
  }

  const { data, error } = await getSupabase()
    .storage.from(CARDS_BUCKET)
    .download(name);

  if (error || !data) {
    return new Response("Картинка не найдена", { status: 404 });
  }

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      // Имя объекта — UUID, содержимое по нему уже не меняется: замена
      // картинки в админке создаёт новый объект с новым именем.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
