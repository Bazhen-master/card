import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import Banner from "@/components/Banner";
import Field from "@/components/Field";
import MoveButton from "@/components/MoveButton";
import SetupNotice from "@/components/SetupNotice";
import { formatPrice, pluralCards } from "@/lib/format";
import { imageSrc } from "@/lib/storage";
import { requireAdmin } from "@/lib/require-admin";
import {
  getSupabase,
  isSupabaseConfigured,
  missingSupabaseEnv,
} from "@/lib/supabase";
import { createDeck, deleteDeck, moveDeck } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Админка" };

export default async function AdminPage({ searchParams }) {
  await requireAdmin();

  if (!isSupabaseConfigured) {
    return (
      <section>
        <AdminHeader title="Админка" />
        <SetupNotice missing={missingSupabaseEnv()} />
      </section>
    );
  }

  const supabase = getSupabase();
  const { data: decks, error } = await supabase
    .from("decks")
    .select("id, title, price, cover_image, cards(count)")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const list = decks ?? [];

  return (
    <section className="space-y-10">
      <AdminHeader title="Админка" />
      <Banner ok={searchParams?.ok} error={searchParams?.error} />

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Не удалось загрузить колоды: {error.message}
        </p>
      )}

      <div>
        <h2 className="mb-4 text-lg font-medium">Колоды</h2>

        {list.length === 0 ? (
          <p className="text-gray-500">Пока ни одной колоды — добавьте первую ниже.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
            {list.map((deck, index) => (
              <li key={deck.id} className="flex items-center gap-4 p-4">
                <div className="h-16 w-12 shrink-0 overflow-hidden rounded bg-cardBg">
                  {deck.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageSrc(deck.cover_image)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/decks/${deck.id}`}
                    className="font-medium hover:text-accent"
                  >
                    {deck.title}
                  </Link>
                  <p className="text-sm text-gray-400">
                    {formatPrice(deck.price)} · {pluralCards(deck.cards?.[0]?.count ?? 0)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <MoveButton
                    action={moveDeck}
                    id={deck.id}
                    direction="up"
                    disabled={index === 0}
                  />
                  <MoveButton
                    action={moveDeck}
                    id={deck.id}
                    direction="down"
                    disabled={index === list.length - 1}
                  />
                  <Link
                    href={`/admin/decks/${deck.id}`}
                    className="rounded border border-gray-300 px-2 py-1 text-xs hover:border-accent hover:text-accent"
                  >
                    Открыть
                  </Link>
                  <form action={deleteDeck}>
                    <input type="hidden" name="id" value={deck.id} />
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

      <div>
        <h2 className="mb-4 text-lg font-medium">Новая колода</h2>
        <form
          action={createDeck}
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-5"
        >
          <Field label="Название" required>
            <input
              name="title"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </Field>

          <Field label="Описание">
            <textarea
              name="description"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </Field>

          <Field label="Цена, ₽" hint="0 — колода бесплатная">
            <input
              name="price"
              type="number"
              min="0"
              step="1"
              defaultValue={0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </Field>

          <Field label="Обложка">
            <input name="cover" type="file" accept="image/*" className="w-full text-sm" />
          </Field>

          <button
            type="submit"
            className="rounded-lg bg-accent px-5 py-2 text-white hover:opacity-90"
          >
            Создать колоду
          </button>
        </form>
      </div>
    </section>
  );
}
