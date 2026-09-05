// Клиент FusionBrain (Kandinsky). Ключи выдаются в личном кабинете
// fusionbrain.ai и оплачиваются на стороне заказчицы.
// Адрес можно подменить переменной окружения — этим пользуется локальная
// проверка на заглушке, чтобы не тратить оплаченные генерации.
const BASE =
  process.env.FUSIONBRAIN_API_URL || "https://api-key.fusionbrain.ai/key/api/v1";

const apiKey = process.env.FUSIONBRAIN_API_KEY;
const secretKey = process.env.FUSIONBRAIN_SECRET_KEY;

export const isFusionBrainConfigured = Boolean(apiKey && secretKey);

export function missingFusionBrainEnv() {
  const missing = [];
  if (!apiKey) missing.push("FUSIONBRAIN_API_KEY");
  if (!secretKey) missing.push("FUSIONBRAIN_SECRET_KEY");
  return missing;
}

// Формат заголовков задан документацией: значение идёт со словом-префиксом.
const authHeaders = () => ({
  "X-Key": `Key ${apiKey}`,
  "X-Secret": `Secret ${secretKey}`,
});

// Стили из каталога FusionBrain. Список меняется редко, поэтому держим его
// здесь, а не ходим за ним на каждый показ формы.
export const STYLES = [
  { id: "DEFAULT", title: "Без стиля" },
  { id: "KANDINSKY", title: "Кандинский" },
  { id: "UHD", title: "Детальное изображение" },
  { id: "ANIME", title: "Аниме" },
];

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error("Сервис генерации не отвечает. Попробуйте позже.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Сервис генерации не принял ключи — проверьте FUSIONBRAIN_API_KEY и FUSIONBRAIN_SECRET_KEY"
    );
  }
  if (response.status === 429) {
    throw new Error("Сервис генерации сейчас перегружен. Попробуйте через минуту.");
  }
  if (!response.ok) {
    throw new Error(`Сервис генерации вернул ошибку ${response.status}`);
  }

  return response.json();
}

// Модель у аккаунта одна и та же, но кэшировать её навсегда не стоит:
// держим id в памяти процесса час.
let pipelineCache = { id: null, expires: 0 };

async function pipelineId() {
  if (pipelineCache.id && pipelineCache.expires > Date.now()) return pipelineCache.id;

  const list = await api("/pipelines");
  const pipeline =
    (Array.isArray(list) && list.find((item) => item.type === "TEXT2IMAGE")) ||
    (Array.isArray(list) && list[0]);
  if (!pipeline?.id) throw new Error("Сервис генерации не вернул ни одной модели");

  pipelineCache = { id: pipeline.id, expires: Date.now() + 60 * 60 * 1000 };
  return pipeline.id;
}

// Генерация занимает от десятка секунд до минуты, поэтому опрашиваем статус.
async function waitForResult(uuid, { timeoutMs = 120000, intervalMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const status = await api(`/pipeline/status/${uuid}`);

    if (status.status === "DONE") {
      if (status.result?.censored || status.censored) {
        throw new Error(
          "Нейросеть отклонила описание по своим правилам. Попробуйте переформулировать."
        );
      }
      // Разные версии API кладут результат по-разному: сейчас это
      // result.files, в прежней версии — images на верхнем уровне.
      const files = status.result?.files ?? status.images ?? status.files ?? [];
      if (!files[0]) throw new Error("Генерация завершилась без картинки");
      return Buffer.from(files[0], "base64");
    }

    if (status.status === "FAIL") {
      throw new Error(
        status.errorDescription || "Нейросети не удалось сгенерировать картинку"
      );
    }
  }

  throw new Error("Генерация заняла слишком много времени. Попробуйте ещё раз.");
}

// Размер по умолчанию — 3:4, в этой пропорции карты показываются в каталоге.
export async function generateImage({ prompt, style, width = 768, height = 1024 }) {
  const params = {
    type: "GENERATE",
    numImages: 1,
    width,
    height,
    generateParams: { query: prompt },
  };
  if (style && style !== "DEFAULT") params.style = style;

  const body = new FormData();
  body.append("pipeline_id", await pipelineId());
  body.append(
    "params",
    new Blob([JSON.stringify(params)], { type: "application/json" }),
    "params.json"
  );

  const started = await api("/pipeline/run", { method: "POST", body });
  if (!started?.uuid) throw new Error("Сервис генерации не принял запрос");

  return waitForResult(started.uuid);
}
