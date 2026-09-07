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

export function generateImage(options) {
  return provider.generateImage(options);
}
