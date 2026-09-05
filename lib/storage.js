import { CARDS_BUCKET } from "@/lib/supabase";

const PUBLIC_PREFIX = `/storage/v1/object/public/${CARDS_BUCKET}/`;

// Загружает файл в Supabase Storage и возвращает публичную ссылку.
// Возвращает null, если файл не выбран, — это позволяет переиспользовать
// хелпер в формах редактирования, где картинка необязательна.
export async function uploadImage(supabase, file) {
  if (!file || typeof file === "string" || file.size === 0) return null;

  const extension = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 8);
  const objectName = `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(CARDS_BUCKET)
    .upload(objectName, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw new Error(`Не удалось загрузить «${file.name}»: ${error.message}`);
  }

  const { data } = supabase.storage.from(CARDS_BUCKET).getPublicUrl(objectName);
  return data.publicUrl;
}

// Удаляет файлы по их публичным ссылкам. Ошибки намеренно не пробрасываем:
// «мусор» в Storage не должен ломать удаление записи в БД.
export async function removeImages(supabase, urls) {
  const names = urls
    .filter(Boolean)
    .map((url) => {
      const index = url.indexOf(PUBLIC_PREFIX);
      return index === -1 ? null : url.slice(index + PUBLIC_PREFIX.length);
    })
    .filter(Boolean);

  if (names.length === 0) return;
  await supabase.storage.from(CARDS_BUCKET).remove(names);
}
