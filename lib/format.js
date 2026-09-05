export function formatPrice(value) {
  if (value === null || value === undefined || value === 0) return "Бесплатно";
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

export function pluralCards(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} карта`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} карты`;
  return `${count} карт`;
}
