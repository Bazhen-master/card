"use client";

import { useFormStatus } from "react-dom";

// Генерация занимает до минуты. Без этой кнопки страница на всё это время
// выглядит так, будто на нажатие ничего не ответило.
export default function SubmitButton({ children, pendingLabel, className = "" }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg bg-accent px-5 py-2.5 text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
