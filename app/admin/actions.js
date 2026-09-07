"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addEntry } from "@/lib/balance";
import { toKopecks } from "@/lib/format";
import { requireAdmin } from "@/lib/require-admin";
import { removeImages, uploadImage } from "@/lib/storage";
import { getSupabase } from "@/lib/supabase";

// Все действия завершаются редиректом на ту же страницу: успех — ?ok=1,
// ошибка — ?error=<текст>. Так пользователь видит результат без клиентского JS.
async function finish(path, work) {
  // Проверяем доступ здесь, а не только в middleware: server action —
  // самостоятельная точка входа, её тоже можно вызвать напрямую.
  await requireAdmin();

  let message = null;
  try {
    await work();
  } catch (error) {
    message = error?.message || "Не удалось выполнить действие";
  }

  revalidatePath(path);
  // "layout" — чтобы обновилась и /catalog, и страницы отдельных колод
  // /catalog/[deckId]: без этого правки видны в списке, но не внутри колоды.
  revalidatePath("/catalog", "layout");
  redirect(message ? `${path}?error=${encodeURIComponent(message)}` : `${path}?ok=1`);
}

// ----------------------------------------------------------- баланс -----
// Пополнение вручную: платёжной системы пока нет, деньги на баланс кладёт
// владелица сайта после перевода. Списание тем же действием — отрицательной
// суммой.
export async function adjustBalance(formData) {
  await finish("/admin/users", async () => {
    const profile = String(formData.get("profile") || "");
    const raw = String(formData.get("amount") || "").trim().replace(",", ".");
    const comment = String(formData.get("comment") || "").trim() || null;

    const rubles = Number.parseFloat(raw);
    if (!Number.isFinite(rubles) || rubles === 0) {
      throw new Error("Укажите сумму — положительную для пополнения, отрицательную для списания");
    }

    const supabase = getSupabase();
    await addEntry(supabase, {
      profile,
      delta: toKopecks(rubles),
      kind: rubles > 0 ? "topup" : "admin",
      comment,
    });
  });
}

export async function toggleBlock(formData) {
  await finish("/admin/users", async () => {
    const id = String(formData.get("profile") || "");
    const blocked = String(formData.get("blocked") || "") === "1";

    const supabase = getSupabase();
    const { error } = await supabase
      .from("profiles")
      .update({ is_blocked: !blocked })
      .eq("id", id);
    if (error) throw new Error(error.message);

    // Заблокированный не должен доходить до страниц по старой cookie.
    if (!blocked) await supabase.from("sessions").delete().eq("profile_id", id);
  });
}

// --------------------------------------------------------- модерация ----
// Карту в галерею пускает владелица сайта: за чужие фотографии и запрещённый
// контент отвечает площадка.
export async function approveCard(formData) {
  await finish("/admin/moderation", async () => {
    const id = String(formData.get("id") || "");
    const supabase = getSupabase();

    const { data: card } = await supabase
      .from("cards")
      .select("id, preview_url, price")
      .eq("id", id)
      .maybeSingle();
    if (!card) throw new Error("Карта не найдена");
    if (!card.preview_url) {
      throw new Error("У карты нет превью с водяным знаком — публиковать нельзя");
    }

    const { error } = await supabase
      .from("cards")
      .update({ status: "listed", listed_at: new Date().toISOString(), reject_reason: null })
      .eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/gallery", "layout");
    revalidatePath("/");
  });
}

export async function rejectCard(formData) {
  await finish("/admin/moderation", async () => {
    const id = String(formData.get("id") || "");
    const reason = String(formData.get("reason") || "").trim();
    if (!reason) throw new Error("Напишите причину — автор должен понять, что исправить");

    const supabase = getSupabase();
    const { error } = await supabase
      .from("cards")
      .update({ status: "rejected", reject_reason: reason, listed_at: null })
      .eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/gallery", "layout");
    revalidatePath("/");
  });
}

function requiredText(formData, field, label) {
  const value = String(formData.get(field) || "").trim();
  if (!value) throw new Error(`Поле «${label}» обязательно`);
  return value;
}

function optionalText(formData, field) {
  const value = String(formData.get(field) || "").trim();
  return value || null;
}

// В форме цена в рублях, в базе — в копейках (см. lib/format.js).
function parsePrice(formData, field, { fallback = null } = {}) {
  const raw = String(formData.get(field) || "").trim().replace(",", ".");
  if (!raw) return fallback;
  const rubles = Number.parseFloat(raw);
  if (Number.isNaN(rubles) || rubles < 0) {
    throw new Error("Цена должна быть неотрицательным числом");
  }
  return toKopecks(rubles);
}

async function nextSortOrder(supabase, table, deckId) {
  let query = supabase
    .from(table)
    .select("sort_order")
    .order("sort_order", { ascending: false });
  if (table === "cards") query = query.eq("deck_id", deckId);

  const { data } = await query.limit(1);
  return (data?.[0]?.sort_order ?? -1) + 1;
}

// Перемещение вверх/вниз: переписываем sort_order всего списка индексами.
// Так порядок остаётся корректным, даже если у строк были одинаковые значения.
async function moveRow(supabase, table, id, direction, deckId) {
  let query = supabase
    .from(table)
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (table === "cards") query = query.eq("deck_id", deckId);

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);

  const index = rows.findIndex((row) => row.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= rows.length) return;

  const reordered = [...rows];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  for (const [position, row] of reordered.entries()) {
    if (row.sort_order === position) continue;
    const { error: updateError } = await supabase
      .from(table)
      .update({ sort_order: position })
      .eq("id", row.id);
    if (updateError) throw new Error(updateError.message);
  }
}

/* ----------------------------------------------------------------- колоды */

export async function createDeck(formData) {
  await finish("/admin", async () => {
    const supabase = getSupabase();
    const title = requiredText(formData, "title", "Название");
    const coverUrl = await uploadImage(supabase, formData.get("cover"));

    const { error } = await supabase.from("decks").insert({
      title,
      description: optionalText(formData, "description"),
      price: parsePrice(formData, "price", { fallback: 0 }),
      cover_image: coverUrl,
      sort_order: await nextSortOrder(supabase, "decks"),
    });
    if (error) throw new Error(error.message);
  });
}

export async function updateDeck(formData) {
  const id = String(formData.get("id") || "");
  await finish(`/admin/decks/${id}`, async () => {
    const supabase = getSupabase();
    const patch = {
      title: requiredText(formData, "title", "Название"),
      description: optionalText(formData, "description"),
      price: parsePrice(formData, "price", { fallback: 0 }),
    };

    const coverUrl = await uploadImage(supabase, formData.get("cover"));
    if (coverUrl) {
      const { data: current } = await supabase
        .from("decks")
        .select("cover_image")
        .eq("id", id)
        .maybeSingle();
      patch.cover_image = coverUrl;
      await removeImages(supabase, [current?.cover_image]);
    }

    const { error } = await supabase.from("decks").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  });
}

export async function deleteDeck(formData) {
  await finish("/admin", async () => {
    const supabase = getSupabase();
    const id = String(formData.get("id") || "");

    // Строки карт удалит каскад в БД, а файлы в Storage нужно убрать вручную.
    const { data: deck } = await supabase
      .from("decks")
      .select("cover_image, cards(image_url)")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase.from("decks").delete().eq("id", id);
    if (error) throw new Error(error.message);

    await removeImages(supabase, [
      deck?.cover_image,
      ...(deck?.cards ?? []).map((card) => card.image_url),
    ]);
  });
}

export async function moveDeck(formData) {
  await finish("/admin", async () => {
    const supabase = getSupabase();
    await moveRow(
      supabase,
      "decks",
      String(formData.get("id") || ""),
      String(formData.get("direction") || "")
    );
  });
}

/* ------------------------------------------------------------------ карты */

export async function createCards(formData) {
  const deckId = String(formData.get("deck_id") || "");
  await finish(`/admin/decks/${deckId}`, async () => {
    const supabase = getSupabase();
    const files = formData
      .getAll("images")
      .filter((file) => file && typeof file !== "string" && file.size > 0);

    if (files.length === 0) throw new Error("Выберите хотя бы одно изображение");

    const text = optionalText(formData, "text");
    const price = parsePrice(formData, "price");
    let order = await nextSortOrder(supabase, "cards", deckId);

    // Грузим по одному файлу, чтобы в ошибке было видно, на каком именно споткнулись.
    for (const file of files) {
      const imageUrl = await uploadImage(supabase, file);
      const { error } = await supabase.from("cards").insert({
        deck_id: deckId,
        image_url: imageUrl,
        // Общий текст осмыслен только при загрузке одной карты.
        text: files.length === 1 ? text : null,
        price,
        source_type: "uploaded",
        sort_order: order++,
      });
      if (error) throw new Error(error.message);
    }
  });
}

export async function updateCard(formData) {
  const deckId = String(formData.get("deck_id") || "");
  await finish(`/admin/decks/${deckId}`, async () => {
    const supabase = getSupabase();
    const id = String(formData.get("id") || "");
    const patch = {
      text: optionalText(formData, "text"),
      price: parsePrice(formData, "price"),
    };

    const imageUrl = await uploadImage(supabase, formData.get("image"));
    if (imageUrl) {
      const { data: current } = await supabase
        .from("cards")
        .select("image_url")
        .eq("id", id)
        .maybeSingle();
      patch.image_url = imageUrl;
      await removeImages(supabase, [current?.image_url]);
    }

    const { error } = await supabase.from("cards").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  });
}

export async function deleteCard(formData) {
  const deckId = String(formData.get("deck_id") || "");
  await finish(`/admin/decks/${deckId}`, async () => {
    const supabase = getSupabase();
    const id = String(formData.get("id") || "");

    const { data: card } = await supabase
      .from("cards")
      .select("image_url")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase.from("cards").delete().eq("id", id);
    if (error) throw new Error(error.message);

    await removeImages(supabase, [card?.image_url]);
  });
}

export async function moveCard(formData) {
  const deckId = String(formData.get("deck_id") || "");
  await finish(`/admin/decks/${deckId}`, async () => {
    const supabase = getSupabase();
    await moveRow(
      supabase,
      "cards",
      String(formData.get("id") || ""),
      String(formData.get("direction") || ""),
      deckId
    );
  });
}
