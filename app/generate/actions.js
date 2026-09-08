"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  STYLES,
  findFormat,
  generateImage,
  isImageProviderConfigured,
} from "@/lib/image-provider";
import {
  ensureSessionId,
  generationsTableReady,
  ipHash,
  generationAllowance,
} from "@/lib/generation-limit";
import { currentProfile } from "@/lib/account";
import { GENERATION_PRICE, addEntry, balanceOf } from "@/lib/balance";
import { formatMoney, formatPrice } from "@/lib/format";
import { uploadImageBuffer, uploadOriginalBuffer } from "@/lib/storage";
import { PREVIEW_UPLOAD, makePreview } from "@/lib/watermark";
import { cardTitleReady } from "@/lib/settings";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

// 2000 символов по просьбе заказчицы (было 500). Предел не технический, а
// разумный: описание переводится на английский и уходит в Flux, а его
// текстовый кодировщик читает примерно первые полторы-две тысячи знаков —
// хвост длинного сочинения на картинку уже не влияет.
const MAX_PROMPT = 2000;

// Название карты — короткая строка, её видят все. Длинное в плитку галереи всё
// равно не влезет, поэтому режем, а не ругаемся: человек писал название, а не
// заполнял форму на точность.
const MAX_TITLE = 60;

// Превью нужно витрине, а не самому посетителю: свою карту он видит целой.
// Поэтому осечка водяного знака не должна отменять генерацию, за которую уже
// заплачено, — карта сохраняется, а причина уходит в лог хостинга. Без превью
// карту нельзя будет выставить в галерею, и это правильное поведение.
async function makeWatermarkedPreview(supabase, image) {
  try {
    const preview = await makePreview(image);
    return await uploadImageBuffer(supabase, preview, PREVIEW_UPLOAD);
  } catch (error) {
    console.error("Превью с водяным знаком не получилось:", error?.message);
    return null;
  }
}

// Плата берётся до генерации: рисование стоит денег поставщику, и списывать
// после — значит рисовать в долг. Если что-то сорвалось, строка списания
// удаляется целиком: показывать посетителю пару «списали — вернули» за
// неслучившуюся картинку незачем.
async function chargeForGeneration(supabase, profile, periodOver = false) {
  // Разные новости: «на сегодня всё» проходит к завтрашнему дню само,
  // «период закончился» — уже нет, и говорить об этом надо прямо.
  const why = periodOver
    ? "Бесплатный период закончился."
    : "Бесплатные генерации на сегодня закончились.";

  if (!profile) {
    throw visible(
      why +
        " Войдите в учётную запись — следующая будет стоить " +
        formatPrice(GENERATION_PRICE) +
        " с баланса."
    );
  }

  const balance = await balanceOf(supabase, profile.id);
  if (balance < GENERATION_PRICE) {
    throw visible(
      why +
        " Следующая стоит " +
        formatPrice(GENERATION_PRICE) +
        ", на балансе " +
        formatMoney(balance) +
        " — пополнение пока делает владелица сайта."
    );
  }

  return addEntry(supabase, {
    profile: profile.id,
    delta: -GENERATION_PRICE,
    kind: "generation",
    comment: "оплата генерации",
  });
}

// Что посетителю говорить можно, а что нельзя.
//
// Сообщения вроде «GenAPI: Недостаточно средств» или «проверьте GENAPI_KEY» —
// разговор с владелицей сайта, а не с человеком, который пришёл нарисовать
// карту: названия сервисов и чужие финансовые дела ему знать незачем, а помочь
// он всё равно не может. Поэтому наружу такие осечки выходят одной вежливой
// строкой, а настоящая причина уходит в лог хостинга.
//
// Всё, что посетитель может исправить сам (пустое описание, слишком длинный
// текст, кончившиеся деньги на его балансе), помечается visible и
// показывается как есть.
const VISITOR_FAILURE =
  "Не получилось нарисовать карту, деньги не списаны — попробуйте, пожалуйста, написать в техподдержку.";

function visible(message) {
  const error = new Error(message);
  error.visible = true;
  return error;
}

export async function generateCard(formData) {
  let cardId = null;
  let message = null;
  let chargeId = null;
  let refundClient = null;
  let profileForRefund = null;

  try {
    if (!isSupabaseConfigured || !isImageProviderConfigured) {
      throw new Error("Генерация ещё не настроена: не заданы ключи доступа");
    }

    const title = String(formData.get("title") || "").trim().slice(0, MAX_TITLE);
    const prompt = String(formData.get("prompt") || "").trim();
    if (!prompt) throw visible("Опишите карту, которую хотите получить");
    if (prompt.length > MAX_PROMPT) {
      throw visible(`Описание длиннее ${MAX_PROMPT} символов — сократите его`);
    }

    const requested = String(formData.get("style") || "DEFAULT");
    const style = STYLES.some((item) => item.id === requested) ? requested : "DEFAULT";
    const format = findFormat(String(formData.get("format") || "")).id;

    const supabase = getSupabase();
    if (!(await generationsTableReady(supabase))) {
      throw new Error(
        "В базе нет таблицы generations — выполните supabase/schema.sql в SQL-редакторе Supabase"
      );
    }

    const session = ensureSessionId();
    const ip = ipHash();
    const profile = await currentProfile();

    refundClient = supabase;
    const { free, periodOver } = await generationAllowance(supabase, {
      session,
      ip,
      profile: profile?.id,
    });
    if (free <= 0) {
      chargeId = await chargeForGeneration(supabase, profile, periodOver);
      profileForRefund = profile?.id ?? null;
    }

    const image = await generateImage({ prompt, style, format });

    // Оригинал — в закрытый бакет, превью со знаком — в публичный.
    const imageUrl = await uploadOriginalBuffer(supabase, image);
    const previewUrl = await makeWatermarkedPreview(supabase, image);

    // Название пишем, только если колонка в базе уже есть: схему выполняет
    // владелица сайта руками, а код приезжает деплоем — между этими моментами
    // генерация обязана работать.
    const withTitle = title && (await cardTitleReady(supabase));

    const { data: card, error } = await supabase
      .from("cards")
      .insert({
        image_url: imageUrl,
        preview_url: previewUrl,
        text: prompt,
        source_type: "generated",
        owner_id: profile?.id ?? null,
        ...(withTitle ? { title } : {}),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    cardId = card.id;

    // Запись о генерации — то, по чему считается лимит. Пишем после успеха:
    // неудачная попытка денег не стоила и лимит тратить не должна.
    const { error: logError } = await supabase.from("generations").insert({
      session_id: session,
      ip_hash: ip,
      profile_id: profile?.id ?? null,
      card_id: cardId,
      prompt,
    });
    // Молча пропустить нельзя: без записи в журнале лимит перестаёт считаться.
    if (logError) {
      throw new Error(`Карта создана, но счётчик генераций не обновился: ${logError.message}`);
    }

    // Списание привязываем к карте: по журналу видно, за что деньги.
    if (chargeId) {
      await supabase.from("balance_entries").update({ card_id: cardId }).eq("id", chargeId);
    }
  } catch (error) {
    const reason = error?.message || "неизвестная причина";
    message = error?.visible ? reason : VISITOR_FAILURE;

    // Настоящую причину видит владелица сайта в логах хостинга — там же, где
    // она узнает, что на GenAPI кончились деньги.
    if (!error?.visible) console.error("Генерация не удалась:", reason);

    // Заплатили, но картинки нет — возвращаем деньги, удаляя строку списания.
    if (chargeId && refundClient) {
      const { error: refundError } = await refundClient
        .from("balance_entries")
        .delete()
        .eq("id", chargeId);

      // Единственный случай, когда человек остаётся без карты и без денег.
      // Сам он об этом не узнает, поэтому строка в логе намеренно кричащая:
      // по ней списание находится и снимается руками в /admin/users.
      if (refundError) {
        console.error(
          "ВОЗВРАТ НЕ ПРОШЁЛ: списание", chargeId,
          "у пользователя", profileForRefund ?? "неизвестен",
          "осталось на человеке, вернуть вручную в /admin/users. Причина:",
          refundError.message
        );
      }
    }
  }

  revalidatePath("/generate");
  redirect(
    message
      ? `/generate?error=${encodeURIComponent(message)}`
      : `/generate?card=${cardId}`
  );
}
