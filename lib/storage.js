import { CARDS_BUCKET, ORIGINALS_BUCKET } from "@/lib/supabase";

const PUBLIC_PREFIX = `/storage/v1/object/public/${CARDS_BUCKET}/`;

// У файла в закрытом бакете нет публичного адреса, поэтому в cards.image_url
// вместо ссылки хранится пометка «лежит там-то». Отличить одно от другого
// нужно во многих местах, отсюда явный префикс.
const PRIVATE_PREFIX = "private://";

export function privateRef(objectName) {
  return `${PRIVATE_PREFIX}${objectName}`;
}

export function privateObjectName(ref) {
  return typeof ref === "string" && ref.startsWith(PRIVATE_PREFIX)
    ? ref.slice(PRIVATE_PREFIX.length)
    : null;
}

// Имя объекта в Storage по его публичной ссылке; null — если ссылка ведёт
// куда-то ещё или её нет вовсе.
export function objectNameFromUrl(url) {
  if (!url) return null;
  const index = url.indexOf(PUBLIC_PREFIX);
  return index === -1 ? null : url.slice(index + PUBLIC_PREFIX.length);
}

// Ссылка для <img src>: картинку отдаёт наш сервер, а не supabase.co напрямую.
// Аудитория проекта в России, и доступность зарубежного домена из браузера
// посетителя не гарантирована — через прокси в вёрстке остаётся один домен,
// наш собственный. Ссылки не из Storage возвращаются как есть.
export function imageSrc(url) {
  // Оригинал из закрытого бакета так показать нельзя — для него есть
  // отдельный маршрут с проверкой прав.
  if (!url || privateObjectName(url)) return null;
  const name = objectNameFromUrl(url);
  return name ? `/api/image/${encodeURIComponent(name)}` : url;
}

// Оригинал карты: маршрут отдаёт его только владельцу, администратору и —
// после Этапа 6.4 — покупателю.
export function originalSrc(card) {
  return card?.id ? `/api/original/${card.id}` : null;
}

// Что показывать в плитке по умолчанию: публичную картинку (карты каталога),
// иначе превью с водяным знаком, иначе — защищённый оригинал. Последнее
// нужно старым картам, у которых превью ещё нет: чужому маршрут ответит
// отказом, владельцу покажет.
export function cardSrc(card) {
  return (
    imageSrc(card?.image_url) ||
    imageSrc(card?.preview_url) ||
    originalSrc(card)
  );
}

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

// Удаляет файлы по ссылкам: публичные из общего бакета, оригиналы — из
// закрытого. Ошибки намеренно не пробрасываем: «мусор» в Storage не должен
// ломать удаление записи в БД.
export async function removeImages(supabase, urls) {
  const refs = (urls ?? []).filter(Boolean);

  const publicNames = refs.map(objectNameFromUrl).filter(Boolean);
  const privateNames = refs.map(privateObjectName).filter(Boolean);

  if (publicNames.length > 0) {
    await supabase.storage.from(CARDS_BUCKET).remove(publicNames);
  }
  if (privateNames.length > 0) {
    await supabase.storage.from(ORIGINALS_BUCKET).remove(privateNames);
  }
}

// Скачивает картинку карты, где бы она ни лежала. Вызывается только с сервера
// и только после проверки прав.
export async function downloadCardImage(supabase, ref) {
  const privateName = privateObjectName(ref);
  if (privateName) {
    return supabase.storage.from(ORIGINALS_BUCKET).download(privateName);
  }

  const name = objectNameFromUrl(ref);
  if (!name) return { data: null, error: { message: "неизвестная ссылка" } };
  return supabase.storage.from(CARDS_BUCKET).download(name);
}

// Оригинал сгенерированной карты — в закрытый бакет. Возвращает не ссылку,
// а пометку private://<имя файла>: публичного адреса у него нет.
export async function uploadOriginalBuffer(
  supabase,
  buffer,
  { contentType = "image/png", extension = "png" } = {}
) {
  const objectName = `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(ORIGINALS_BUCKET)
    .upload(objectName, buffer, { contentType, upsert: false });

  if (error) {
    throw new Error(`Не удалось сохранить оригинал карты: ${error.message}`);
  }

  return privateRef(objectName);
}

// Сохраняет уже готовые байты картинки — этим путём приходит результат
// генерации, у него нет File из формы.
export async function uploadImageBuffer(
  supabase,
  buffer,
  { contentType = "image/png", extension = "png" } = {}
) {
  const objectName = `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(CARDS_BUCKET)
    .upload(objectName, buffer, { contentType, upsert: false });

  if (error) {
    throw new Error(`Не удалось сохранить картинку: ${error.message}`);
  }

  const { data } = supabase.storage.from(CARDS_BUCKET).getPublicUrl(objectName);
  return data.publicUrl;
}
