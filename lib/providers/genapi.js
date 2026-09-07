// Клиент GenAPI (gen-api.ru) — один ключ на весь каталог моделей, оплата
// рублями, работает из России без VPN. По умолчанию рисуем на Flux Schnell:
// порядка 0,5 ₽ за картинку. Переключение на более дорогую и качественную
// модель — переменная GENAPI_MODEL, переписывать код для этого не нужно.
const BASE = process.env.GENAPI_API_URL || "https://api.gen-api.ru/api/v1";

const key = process.env.GENAPI_KEY;
// Сеть — это адрес эндпоинта, модель — версия внутри неё.
// Допустимые версии flux: schnell, dev, pro, pro_v1.1, ultra, max.
// У части сетей (например, sdxl) версии нет вовсе — тогда GENAPI_MODEL
// оставляют пустым, и параметр не уходит в запрос.
const network = process.env.GENAPI_NETWORK || "flux";
const model = process.env.GENAPI_MODEL ?? "schnell";
// Flux почти не понимает русский: на запрос «распахнутое окно в старой комнате»
// он рисует что-то своё. Поэтому описание посетителя сначала переводим — это
// самая дешёвая модель в каталоге, треть копейки за запрос. Пустое значение
// переменной выключает перевод (например, для сетей, знающих русский).
const translateModel =
  process.env.GENAPI_TRANSLATE_MODEL ?? "gemini-2-5-flash-lite";

// Flux понимает английский заметно лучше русского, поэтому стиль добавляется
// хвостом к описанию посетителя. Общий хвост объясняет нейросети, что именно
// она рисует: метафорическую ассоциативную карту для работы психолога, а не
// иллюстрацию к тексту. Без этого Flux сбивается на «красивую картинку» —
// буквальную, перегруженную деталями, с подписями и рамкой. Ключевое здесь —
// один образ, допускающий разные прочтения: на приёме клиент видит в карте
// своё, и однозначная сцена такой работе мешает.
const BASE_PROMPT =
  "metaphorical association card (OH-cards style) for a psychologist's session, " +
  "an image a therapist shows a client to start a conversation about feelings, " +
  "one evocative symbolic scene open to many interpretations, " +
  "emotionally resonant, calm and safe, leaves room for the client's own projection, " +
  "not a literal illustration, uncluttered composition, soft depth, " +
  "no text, no lettering, no watermark, no signature, unsigned, no frame, no border";

const STYLES = [
  { id: "DEFAULT", title: "Без стиля", prompt: "" },
  {
    id: "WATERCOLOR",
    title: "Акварель",
    prompt: "delicate watercolour painting, soft washes, visible paper texture",
  },
  {
    id: "OIL",
    title: "Масляная живопись",
    prompt: "expressive oil painting, visible brush strokes, rich impasto texture",
  },
  {
    id: "PASTEL",
    title: "Пастель",
    prompt: "soft pastel drawing, muted palette, gentle diffused light",
  },
  {
    id: "SURREAL",
    title: "Сюрреализм",
    prompt: "dreamlike surrealism, impossible composition, symbolic objects",
  },
  {
    id: "INK",
    title: "Графика",
    prompt: "ink and graphite illustration, fine linework, limited palette",
  },
];

function missingEnv() {
  return key ? [] : ["GENAPI_KEY"];
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        ...(options.headers || {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error("Сервис генерации не отвечает. Попробуйте позже.");
  }

  // Текст ошибки от GenAPI приходит по-русски и по делу («Недостаточно
  // средств», «Токен не указан») — показываем его, а не только номер.
  const payload = await response.json().catch(() => null);
  const detail = payload?.error || payload?.message || "";

  if (response.status === 401 || response.status === 403) {
    throw new Error("Сервис генерации не принял ключ — проверьте GENAPI_KEY");
  }
  if (response.status === 402) {
    // Свой текст у GenAPI бывает полезнее общего: например, он подсказывает
    // про стартовый баланс за подтверждение телефона.
    throw new Error(
      detail
        ? `GenAPI: ${detail}`
        : "На балансе GenAPI закончились деньги — пополните его в личном кабинете gen-api.ru"
    );
  }
  if (response.status === 429) {
    throw new Error("Сервис генерации сейчас перегружен. Попробуйте через минуту.");
  }
  if (!response.ok) {
    throw new Error(
      detail
        ? `Сервис генерации отказал: ${detail}`
        : `Сервис генерации вернул ошибку ${response.status}`
    );
  }

  return payload;
}

const CYRILLIC = /[а-яё]/i;

// Перевод не должен ронять генерацию: если языковая модель не ответила или
// вернула что-то странное, рисуем по исходному описанию. Хуже перевести не
// вышло — хуже отказать посетителю.
async function toEnglish(text) {
  if (!translateModel || !CYRILLIC.test(text)) return text;

  try {
    const answer = await api(`/networks/${translateModel}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_sync: true,
        messages: [
          {
            role: "system",
            content:
              "Translate the user's image description from Russian to English. " +
              "Keep it a plain description, do not add or explain anything. " +
              "Answer with the translation only.",
          },
          { role: "user", content: text },
        ],
      }),
    });

    const translated = answer?.response?.[0]?.message?.content;
    if (typeof translated === "string" && translated.trim()) return translated.trim();

    console.error("Перевод описания вернул неожиданный ответ:", JSON.stringify(answer)?.slice(0, 300));
    return text;
  } catch (error) {
    // Тихо откатываться нельзя: картинка получится не по описанию, а понять
    // почему — будет неоткуда. В лог хостинга пишем причину.
    console.error("Перевод описания не удался:", error?.message);
    return text;
  }
}

// Ответ приходит ссылкой на картинку, но по какому ключу — зависит от модели:
// у части каталога это result, у части output или full_response, внутри могут
// лежать как строки, так и объекты. Разбираем все известные формы.
function resultUrl(payload) {
  const sources = [payload?.result, payload?.output, payload?.full_response];

  for (const source of sources) {
    let value = source;
    if (typeof value === "string" && value.trim().startsWith("[")) {
      try {
        value = JSON.parse(value);
      } catch {
        // не JSON — ниже отработает как обычная строка
      }
    }

    const items = Array.isArray(value) ? value : value ? [value] : [];
    for (const item of items) {
      const url = typeof item === "string" ? item : item?.url || item?.image_url;
      if (typeof url === "string" && url.startsWith("http")) return url;
    }
  }

  return null;
}

// Генерация асинхронная: запрос возвращает номер задачи, картинка появляется
// через несколько секунд. Long-polling у GenAPI тоже есть, но опрос надёжнее:
// зависшее соединение здесь не съедает весь таймаут server action.
async function waitForResult(id, { timeoutMs = 120000, intervalMs = 2000 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const status = await api(`/request/get/${id}`);
    const state = String(status?.status || "").toLowerCase();

    if (state === "success" || state === "completed" || state === "done") {
      const url = resultUrl(status);
      if (!url) throw new Error("Генерация завершилась без картинки");
      return url;
    }

    if (state === "error" || state === "failed" || state === "cancelled") {
      throw new Error(
        status?.error ||
          status?.result ||
          "Нейросети не удалось сгенерировать картинку"
      );
    }
  }

  throw new Error("Генерация заняла слишком много времени. Попробуйте ещё раз.");
}

async function download(url) {
  let response;
  try {
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(60000) });
  } catch {
    throw new Error("Картинка сгенерирована, но её не удалось скачать. Попробуйте ещё раз.");
  }
  if (!response.ok) {
    throw new Error(`Картинку не удалось скачать: сервис ответил ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

// Размер приходит из формы (список форматов — в lib/image-provider.js).
// Значения по умолчанию — 3:4, пропорция готовых колод в каталоге. Flux
// работает с размерами, кратными 32.
async function generateImage({ prompt, style, width = 768, height = 1024 }) {
  const preset = STYLES.find((item) => item.id === style);
  const query = [await toEnglish(prompt), preset?.prompt, BASE_PROMPT]
    .filter(Boolean)
    .join(", ");

  // Описание в логе — единственный способ понять задним числом, почему карта
  // вышла не такой, как просил посетитель. Оно и так лежит в cards.text.
  console.log(`[${network}/${model || "—"}] ${query}`);

  const started = await api(`/networks/${network}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(model ? { model } : {}),
      prompt: query,
      width,
      height,
      num_images: 1,
    }),
  });

  const id = started?.request_id ?? started?.id ?? started?.data?.request_id;
  if (!id) throw new Error("Сервис генерации не принял запрос");

  return download(await waitForResult(id));
}

export const genapi = {
  id: "genapi",
  title: `GenAPI, ${network} ${model}`,
  keysUrl: "https://gen-api.ru/account/api-keys",
  styles: STYLES,
  missingEnv,
  generateImage,
};
