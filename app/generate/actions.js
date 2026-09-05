"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  STYLES,
  generateImage,
  isFusionBrainConfigured,
} from "@/lib/fusionbrain";
import {
  ensureSessionId,
  generationsTableReady,
  ipHash,
  remainingGenerations,
} from "@/lib/generation-limit";
import { uploadImageBuffer } from "@/lib/storage";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const MAX_PROMPT = 500;

export async function generateCard(formData) {
  let cardId = null;
  let message = null;

  try {
    if (!isSupabaseConfigured || !isFusionBrainConfigured) {
      throw new Error("Генерация ещё не настроена: не заданы ключи доступа");
    }

    const prompt = String(formData.get("prompt") || "").trim();
    if (!prompt) throw new Error("Опишите карту, которую хотите получить");
    if (prompt.length > MAX_PROMPT) {
      throw new Error(`Описание длиннее ${MAX_PROMPT} символов — сократите его`);
    }

    const requested = String(formData.get("style") || "DEFAULT");
    const style = STYLES.some((item) => item.id === requested) ? requested : "DEFAULT";

    const supabase = getSupabase();
    if (!(await generationsTableReady(supabase))) {
      throw new Error(
        "В базе нет таблицы generations — выполните supabase/schema.sql в SQL-редакторе Supabase"
      );
    }

    const session = ensureSessionId();
    const ip = ipHash();

    if ((await remainingGenerations(supabase, { session, ip })) <= 0) {
      throw new Error("Лимит генераций на сегодня исчерпан. Попробуйте завтра.");
    }

    const image = await generateImage({ prompt, style });
    const imageUrl = await uploadImageBuffer(supabase, image);

    const { data: card, error } = await supabase
      .from("cards")
      .insert({ image_url: imageUrl, text: prompt, source_type: "generated" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    cardId = card.id;

    // Запись о генерации — то, по чему считается лимит. Пишем после успеха:
    // неудачная попытка денег не стоила и лимит тратить не должна.
    const { error: logError } = await supabase.from("generations").insert({
      session_id: session,
      ip_hash: ip,
      card_id: cardId,
      prompt,
    });
    // Молча пропустить нельзя: без записи в журнале лимит перестаёт считаться.
    if (logError) {
      throw new Error(`Карта создана, но счётчик генераций не обновился: ${logError.message}`);
    }
  } catch (error) {
    message = error?.message || "Не удалось сгенерировать карту";
  }

  revalidatePath("/generate");
  redirect(
    message
      ? `/generate?error=${encodeURIComponent(message)}`
      : `/generate?card=${cardId}`
  );
}
