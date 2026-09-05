// Кнопка «выше/ниже». Каждая — отдельная форма: вложенные формы в HTML
// запрещены, а на странице рядом живут формы удаления и редактирования.
export default function MoveButton({ action, id, direction, disabled, deckId }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      {deckId && <input type="hidden" name="deck_id" value={deckId} />}
      <button
        type="submit"
        disabled={disabled}
        aria-label={direction === "up" ? "Переместить выше" : "Переместить ниже"}
        className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-30 enabled:hover:border-accent"
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}
