// Единый вид для сообщений об успехе/ошибке после действий в админке.
export default function Banner({ ok, error }) {
  if (error) {
    return (
      <p className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </p>
    );
  }
  if (ok) {
    // Действие может вернуть свой текст — например, сколько повторов пропущено
    // при загрузке. «1» — обычное «просто получилось».
    return (
      <p className="mb-6 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
        {ok === "1" ? "Сохранено." : ok}
      </p>
    );
  }
  return null;
}
