import Link from "next/link";
import { notFound } from "next/navigation";
import AdminHeader from "@/components/AdminHeader";
import Banner from "@/components/Banner";
import Field from "@/components/Field";
import MoveButton from "@/components/MoveButton";
import SetupNotice from "@/components/SetupNotice";
import { requireAdmin } from "@/lib/require-admin";
import {
  getSupabase,
  isSupabaseConfigured,
  missingSupabaseEnv,
} from "@/lib/supabase";
import {
  createCards,
  deleteCard,
  moveCard,
  updateCard,
  updateDeck,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminDeckPage({ params, searchParams }) {
  await requireAdmin();

  if (!isSupabaseConfigured) {
    return (
      <section>
        <AdminHeader title="Колода" backHref="/admin" backLabel="Все колоды" />
        <SetupNotice missing={missingSupabaseEnv()} />
      </section>
    );
  }

  const supabase = getSupabase();
  const { data: deck, error } = await supabase
    .from("decks")
    .select("id, title, description, price, cover_image")
    .eq("id", params.deckId)
    .maybeSingle();

  if (error || !deck) notFound();

  const { data: cards } = await supabase
    .from("cards")
    .select("id, image_url, text, price")
    .eq("deck_id", deck.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const list = cards ?? [];

  return (
    <section className="space-y-10">
      <AdminHeader title={deck.title} backHref="/admin" backLabel="Все колоды" />
      <Banner ok={searchParams?.ok} error={searchParams?.error} />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">Настройки колоды</h2>
          <Link
            href={`/catalog/${deck.id}`}
            className="text-sm text-gray-400 hover:text-accent"
          >
            Посмотреть на сайте →
          </Link>
        </div>

        <form
          action={updateDeck}
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-5"
        >
          <input type="hidden" name="id" value={deck.id} />

          <Field label="Название" required>
            <input
              name="title"
              required
              defaultValue={deck.title}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </Field>

          <Field label="Описание">
            <textarea
              name="description"
              rows={3}
              defaultValue={deck.description ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </Field>

          <Field label="Цена, ₽">
            <input
              name="price"
              type="number"
              min="0"
              step="1"
              defaultValue={deck.price ?? 0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </Field>

          <div className="flex items-end gap-4">
            <div className="h-24 w-[4.5rem] shrink-0 overflow-hidden rounded bg-cardBg">
              {deck.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={deck.cover_image}
                  alt=""
                  className="h-24 w-[4.5rem] object-cover"
                />
              ) : null}
            </div>
            <div className="flex-1">
              <Field
                label="Заменить обложку"
                hint="Оставьте пустым, чтобы сохранить текущую"
              >
                <input
                  name="cover"
                  type="file"
                  accept="image/*"
                  className="w-full text-sm"
                />
              </Field>
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-accent px-5 py-2 text-white hover:opacity-90"
          >
            Сохранить
          </button>
        </form>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium">Добавить карты</h2>
        <form
          action={createCards}
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-5"
        >
          <input type="hidden" name="deck_id" value={deck.id} />

          <Field
            label="Изображения"
            required
            hint="Можно выбрать сразу несколько файлов — каждый станет отдельной картой"
          >
            <input
              name="images"
              type="file"
              accept="image/*"
              multiple
              required
              className="w-full text-sm"
            />
          </Field>

          <Field label="Текст карты" hint="Применяется, только если загружается один файл">
            <input
              name="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </Field>

          <Field label="Цена поштучно, ₽" hint="Пусто — карта продаётся только в составе колоды">
            <input
              name="price"
              type="number"
              min="0"
              step="1"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </Field>

          <button
            type="submit"
            className="rounded-lg bg-accent px-5 py-2 text-white hover:opacity-90"
          >
            Загрузить
          </button>
        </form>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium">
          Карты в колоде ({list.length})
        </h2>

        {list.length === 0 ? (
          <p className="text-gray-500">Карт пока нет.</p>
        ) : (
          <ul className="space-y-3">
            {list.map((card, index) => (
              <li
                key={card.id}
                className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-start"
              >
                <div className="h-28 w-[5.25rem] shrink-0 overflow-hidden rounded bg-cardBg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.image_url}
                    alt=""
                    className="h-28 w-[5.25rem] object-cover"
                  />
                </div>

                <form action={updateCard} className="flex-1 space-y-3">
                  <input type="hidden" name="id" value={card.id} />
                  <input type="hidden" name="deck_id" value={deck.id} />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Текст">
                      <input
                        name="text"
                        defaultValue={card.text ?? ""}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </Field>
                    <Field label="Цена, ₽">
                      <input
                        name="price"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={card.price ?? ""}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </Field>
                  </div>

                  <Field label="Заменить изображение">
                    <input
                      name="image"
                      type="file"
                      accept="image/*"
                      className="w-full text-sm"
                    />
                  </Field>

                  <button
                    type="submit"
                    className="rounded-lg border border-accent px-4 py-1.5 text-sm text-accent hover:bg-accent/10"
                  >
                    Сохранить карту
                  </button>
                </form>

                <div className="flex shrink-0 items-center gap-1">
                  <MoveButton
                    action={moveCard}
                    id={card.id}
                    deckId={deck.id}
                    direction="up"
                    disabled={index === 0}
                  />
                  <MoveButton
                    action={moveCard}
                    id={card.id}
                    deckId={deck.id}
                    direction="down"
                    disabled={index === list.length - 1}
                  />
                  <form action={deleteCard}>
                    <input type="hidden" name="id" value={card.id} />
                    <input type="hidden" name="deck_id" value={deck.id} />
                    <button
                      type="submit"
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Удалить
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
