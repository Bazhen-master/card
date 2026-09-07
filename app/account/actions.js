"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  adoptAnonymousHistory,
  createAccount,
  endSession,
  signIn,
  startSession,
} from "@/lib/account";
import { safeRedirectPath } from "@/lib/auth";

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

export async function logoutAction() {
  await endSession();
  revalidatePath("/", "layout");
  redirect("/");
}
