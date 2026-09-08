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

export function pluralCards(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} карта`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} карты`;
  return `${count} карт`;
}
