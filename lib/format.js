// Деньги в базе — копейки. Причина в плане (Этап 6.3): комиссия площадки
// с карты за 3 ₽ в целых рублях не считается. Посетителю везде показываем
// рубли, копейки наружу не выходят.
export const MIN_CARD_PRICE = 300; // 3 ₽ — минимум, оговорённый с заказчицей

// Сумма как есть: «0 ₽», «3 ₽», «3,5 ₽», «3,05 ₽». Лишних нулей не пишем.
export function formatMoney(kopecks) {
  const text = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format((kopecks ?? 0) / 100);

  return `${text} ₽`;
}

// Цена: ноль означает «отдаётся даром», и так и написано. Для остатка на счету
// это не годится — «Баланс: Бесплатно» посетитель читает как ошибку, — поэтому
// суммы показываются через formatMoney.
export function formatPrice(kopecks) {
  if (kopecks === null || kopecks === undefined || kopecks === 0) return "Бесплатно";
  return formatMoney(kopecks);
}

export function toKopecks(rubles) {
  return Math.round(Number(rubles) * 100);
}

export function toRubles(kopecks) {
  return (kopecks ?? 0) / 100;
}

// Дата по-русски и по-московски: «15 сентября», а если год не текущий —
// с годом. Часовой пояс задан явно: сервер стоит не в Москве, и без этого
// вечерняя дата уезжала бы на сутки назад.
export function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "Europe/Moscow",
  }).format(date);
}

// Склонение числительных: «1 карта», «2 карты», «5 карт». Правило одно на все
// слова, меняются только окончания, поэтому формы передаются списком.
function plural(count, [one, few, many]) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;
  return `${count} ${many}`;
}

export function pluralCards(count) {
  return plural(count, ["карта", "карты", "карт"]);
}

export function pluralGenerations(count) {
  return plural(count, ["генерация", "генерации", "генераций"]);
}
