"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/account";
import { purchaseCard } from "@/lib/balance";

export async function buyCardAction(formData) {
  const cardId = String(formData.get("card") || "");
  let failure = null;

  try {
    const profile = await currentProfile();
    // Кнопки у гостя нет, но действие — самостоятельная точка входа: проверяем
    // здесь, а не только в вёрстке.
    if (!profile) throw new Error("Сначала войдите в учётную запись");

    await purchaseCard({ buyer: profile, cardId });
  } catch (error) {
    failure = error?.message || "Не удалось купить карту";
  }

  revalidatePath(`/gallery/${cardId}`);
  revalidatePath("/account");

  if (failure) {
    redirect(`/gallery/${cardId}?error=${encodeURIComponent(failure)}`);
  }
  redirect(`/gallery/${cardId}?bought=1`);
}
