"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  adoptAnonymousHistory,
  createAccount,
  currentProfile,
  endSession,
  signIn,
  startSession,
} from "@/lib/account";
import { safeRedirectPath } from "@/lib/auth";
import { MIN_CARD_PRICE, formatPrice, toKopecks } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";

// Ошибку возвращаем на ту же форму адресной строкой, вместе с уже введённой
// почтой: заставлять набирать её заново из-за опечатки в пароле — плохо.
function back(page, message, email, from) {
  const params = new URLSearchParams({ error: message });
  if (email) params.set("email", email);
  if (from) params.set("from", from);
  return `${page}?${params}`;
}

export async function registerAction(formData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const repeat = String(formData.get("repeat") || "");
  const consent = formData.get("consent");
  const from = safeRedirectPath(formData.get("from"), "/account");
  let failure = null;

  try {
    if (password !== repeat) throw new Error("Пароли не совпадают");
    if (!consent) {
      throw new Error("Без согласия на обработку данных зарегистрировать не сможем");
    }

    const profile = await createAccount({ email, password });
    await startSession(profile.id);
    await adoptAnonymousHistory(profile.id);
  } catch (error) {
    failure = error?.message || "Не удалось зарегистрироваться";
  }

  // redirect работает через исключение, поэтому только после try/catch.
  if (failure) redirect(back("/register", failure, email, from));

  revalidatePath("/", "layout");
  redirect(from);
}

export async function loginAction(formData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const from = safeRedirectPath(formData.get("from"), "/account");
  let failure = null;

  try {
    const profile = await signIn({ email, password });
    await startSession(profile.id);
    await adoptAnonymousHistory(profile.id);
  } catch (error) {
    failure = error?.message || "Не удалось войти";
  }

  if (failure) redirect(back("/login", failure, email, from));

  revalidatePath("/", "layout");
  redirect(from);
}

// Общая обёртка для действий в кабинете: результат показывается на той же
// странице, без клиентского JS — как и в админке.
async function inAccount(work) {
  let message = null;

  try {
    const profile = await currentProfile();
    if (!profile) throw new Error("Сначала войдите в учётную запись");
    await work(getSupabase(), profile);
  } catch (error) {
    message = error?.message || "Не удалось выполнить действие";
  }

  revalidatePath("/account");
  redirect(message ? `/account?error=${encodeURIComponent(message)}` : "/account?ok=1");
}

// Своя карта, и только своя: номер карты приходит из формы, а форму можно
// подделать.
async function ownCard(supabase, profile, formData) {
  const id = String(formData.get("card") || "");
  const { data: card } = await supabase
    .from("cards")
    .select("id, owner_id, preview_url, status")
    .eq("id", id)
    .maybeSingle();

  if (!card || card.owner_id !== profile.id) {
    throw new Error("Карта не найдена среди ваших");
  }
  return card;
}

// Цена из формы: в поле пишут и «3,5», и «3.5», а в базе лежат копейки.
function priceFromForm(formData) {
  const raw = String(formData.get("price") || "").trim().replace(",", ".");
  const price = toKopecks(Number.parseFloat(raw));
  if (!Number.isFinite(price) || price < MIN_CARD_PRICE) {
    throw new Error(`Цена не может быть меньше ${formatPrice(MIN_CARD_PRICE)}`);
  }
  return price;
}

export async function publishCardAction(formData) {
  await inAccount(async (supabase, profile) => {
    const card = await ownCard(supabase, profile, formData);

    // Без превью карта уйдёт в галерею без водяного знака — то есть даром.
    if (!card.preview_url) {
      throw new Error(
        "У этой карты нет превью с водяным знаком — в галерею её пустить нельзя. Нарисуйте карту заново."
      );
    }

    const price = priceFromForm(formData);

    const { error } = await supabase
      .from("cards")
      .update({ status: "pending", price, reject_reason: null })
      .eq("id", card.id);
    if (error) throw new Error(error.message);
  });
}

// Смена цены у карты, которая уже на проверке или в галерее. Повторной
// модерации не требует намеренно: проверяют картинку, а не ценник, и гонять
// карту через очередь из-за рубля — терять её место на витрине. Купленные
// карты это не задевает: в purchases цена записана на момент покупки.
export async function changePriceAction(formData) {
  await inAccount(async (supabase, profile) => {
    const card = await ownCard(supabase, profile, formData);

    if (card.status !== "listed" && card.status !== "pending") {
      throw new Error("Цену можно менять у карты на проверке или в галерее");
    }

    const price = priceFromForm(formData);

    const { error } = await supabase
      .from("cards")
      .update({ price })
      .eq("id", card.id);
    if (error) throw new Error(error.message);

    // Новая цена должна тут же встать и на витрине, и на главной.
    revalidatePath("/gallery", "layout");
    revalidatePath("/");
  });
}

export async function withdrawCardAction(formData) {
  await inAccount(async (supabase, profile) => {
    const card = await ownCard(supabase, profile, formData);

    const { error } = await supabase
      .from("cards")
      .update({ status: "private", listed_at: null })
      .eq("id", card.id);
    if (error) throw new Error(error.message);

    // Карта уходит с витрины — обновляем и её, и главную с каруселью.
    revalidatePath("/gallery", "layout");
    revalidatePath("/");
  });
}

export async function saveNameAction(formData) {
  await inAccount(async (supabase, profile) => {
    const name = String(formData.get("display_name") || "").trim().slice(0, 40);

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name || null })
      .eq("id", profile.id);
    if (error) throw new Error(error.message);

    revalidatePath("/gallery", "layout");
  });
}

export async function logoutAction() {
  await endSession();
  revalidatePath("/", "layout");
  redirect("/");
}
