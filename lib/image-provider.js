// Единая точка входа для генерации картинок. Страницы и server actions знают
// только про этот модуль: сменить нейросеть — значит поменять переменную
// IMAGE_PROVIDER на хостинге, а не переписывать код. Поводом стала история с
// FusionBrain: переезд на другого поставщика стоил слишком дорого.
import { fusionbrain } from "./providers/fusionbrain";
import { genapi } from "./providers/genapi";

const PROVIDERS = { genapi, fusionbrain };
const DEFAULT_PROVIDER = "genapi";

const requested = (process.env.IMAGE_PROVIDER || DEFAULT_PROVIDER).toLowerCase().trim();
const provider = PROVIDERS[requested] || PROVIDERS[DEFAULT_PROVIDER];

// Опечатка в имени поставщика не должна тихо уводить на другой сервис: такую
// настройку показываем тем же способом, что и незаполненный ключ.
const unknownProvider = !PROVIDERS[requested];

export const PROVIDER_TITLE = provider.title;
export const PROVIDER_KEYS_URL = provider.keysUrl;
export const STYLES = provider.styles;

// Форматы карты. От поставщика не зависят: это просто пара сторон, поэтому
// список живёт здесь, а не в клиенте конкретной нейросети. Размеры кратны 32 —
// этого требует Flux, Kandinsky такие тоже принимает.
export const FORMATS = [
  {
    id: "PORTRAIT",
    title: "Вертикальный",
    hint: "3:4, как в готовых колодах",
    width: 768,
    height: 1024,
  },
  {
    id: "LANDSCAPE",
    title: "Горизонтальный",
    hint: "4:3",
    width: 1024,
    height: 768,
  },
  {
    id: "SQUARE",
    title: "Квадрат",
    hint: "1:1",
    width: 1024,
    height: 1024,
  },
];

export const DEFAULT_FORMAT = "PORTRAIT";

// Неизвестное значение (старая ссылка, правка формы в браузере) не должно
// ронять генерацию — молча берём формат по умолчанию.
export function findFormat(id) {
  return (
    FORMATS.find((format) => format.id === id) ||
    FORMATS.find((format) => format.id === DEFAULT_FORMAT)
  );
}

export function missingImageProviderEnv() {
  if (unknownProvider) {
    return [
      `IMAGE_PROVIDER=${requested} — такого поставщика нет, допустимо: ${Object.keys(
        PROVIDERS
      ).join(", ")}`,
    ];
  }
  return provider.missingEnv();
}

export const isImageProviderConfigured = missingImageProviderEnv().length === 0;

export function generateImage({ format, ...options }) {
  const { width, height } = findFormat(format);
  return provider.generateImage({ ...options, width, height });
}
