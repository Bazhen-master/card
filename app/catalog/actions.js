"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { TARIFFS } from "@/lib/tariffs";

const HOUR = 60 * 60 * 1000;

// Клик по кнопке — уже сигнал, поэтому запись создаётся сразу, до всякого
// контакта. Оставит человек почту или закроет страницу — видно и то, и другое.
export async function recordInterest(formData) {
  const deck = String(formData.get("deck") || "") || null;
  const requested = String(formData.get("tariff") || "deck");
  const tariff = TARIFFS[requested] ? requested : "deck";

  let leadId = null;
  let failure = null;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("leads")
      .insert({ deck_id: deck, tariff })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    leadId = data.id;
  } catch (error) {
    failure = error?.message || "Не удалось записать заявку";
  }

  const path = deck ? `/catalog/${deck}` : "/catalog";
  revalidatePath(path);

  redirect(
    failure
      ? `${path}?error=${encodeURIComponent(failure)}`
      : `${path}?lead=${leadId}&tariff=${tariff}`
  );
}

export async function saveContact(formData) {
  const deck = String(formData.get("deck") || "") || null;
  const leadId = String(formData.get("lead") || "");
  const contact = String(formData.get("contact") || "").trim().slice(0, 120);

  let failure = null;

  try {
    if (!contact) throw new Error("Оставьте почту или телефон — иначе мы не сможем ответить");

    const supabase = getSupabase();
    // Номер заявки виден в адресной строке, поэтому дописываем контакт только
    // в свежую и ещё пустую запись: чужую так не перезаписать.
    const { data, error } = await supabase
      .from("leads")
      .update({ contact })
      .eq("id", leadId)
      .is("contact", null)
      .gte("created_at", new Date(Date.now() - HOUR).toISOString())
      .select("id");

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error("Заявка устарела — нажмите кнопку ещё раз");
    }
  } catch (error) {
    failure = error?.message || "Не удалось сохранить контакт";
  }

  const path = deck ? `/catalog/${deck}` : "/catalog";
  revalidatePath(path);

  redirect(
    failure
      ? `${path}?lead=${leadId}&error=${encodeURIComponent(failure)}`
      : `${path}?thanks=1`
  );
}
