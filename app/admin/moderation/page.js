import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import Banner from "@/components/Banner";
import SetupNotice from "@/components/SetupNotice";
import { approveCard, rejectCard } from "../actions";
import { formatPrice } from "@/lib/format";
import { requireAdmin } from "@/lib/require-admin";
import { cardSrc } from "@/lib/storage";
import {
  getSupabase,
  isSupabaseConfigured,
  missingSupabaseEnv,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = { title: "Модерация галереи" };

export default async function ModerationPage({ searchParams }) {
  await requireAdmin();

  if (!isSupabaseConfigured) {
    return (
      <section>
        <AdminHeader title="Модерация галереи" backHref="/admin" backLabel="Админка" />
        <SetupNotice missing={missingSupabaseEnv()} />
      </section>
    );
  }

  const supabase = getSupabase();
  const { data: pending } = await supabase
    .from("cards")
    .select("id, preview_url, image_url, text, price, created_at, profiles(display_name, email)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const { data: listed } = await supabase
    .from("cards")
    .select("id, text, price, listed_at, profiles(display_name, email)")
    .eq("status", "listed")
    .order("listed_at", { ascending: false })
    .limit(20);

  const queue = pending ?? [];

  return (
    <section className="space-y-10">
      <AdminHeader title="Модерация галереи" backHref="/admin" backLabel="Админка" />
      <Banner ok={searchParams?.ok} error={searchParams?.error} />

      <div className="space-y-4">
        <h2 className="text-lg font-medium">На проверке ({queue.length})</h2>

        {queue.length === 0 ? (
          <p className="text-gray-500">Очередь пуста.</p>
        ) : (
          <ul className="space-y-4">
            {queue.map((card) => (
              <li
                key={card.id}
                className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row"
              >
                <div className="w-40 shrink-0 overflow-hidden rounded-lg bg-cardBg">
                  {/* Показываем превью — ровно то, что увидит посетитель.
                      Оригинал открывается ссылкой ниже. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cardSrc(card)} alt="" className="block w-full" />
                </div>

                <div className="flex-1 space-y-3 text-sm">
                  <div>
                    <p className="text-gray-800">{card.text || "без описания"}</p>
                    <p className="text-gray-500">
                      Автор: {card.profiles?.display_name || "без имени"} (
                      {card.profiles?.email}) · цена {formatPrice(card.price)}
                    </p>
                    <a
                      href={`/api/original/${card.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-gray-400 hover:text-accent"
                    >
                      Посмотреть оригинал без знака →
                    </a>
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <form action={approveCard}>
                      <input type="hidden" name="id" value={card.id} />
                      <button
                        type="submit"
                        className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
                      >
                        Опубликовать
                      </button>
                    </form>

                    <form action={rejectCard} className="flex items-end gap-2">
                      <input type="hidden" name="id" value={card.id} />
                      <label className="text-xs text-gray-500">
                        Причина отказа
                        <input
                          name="reason"
                          required
                          placeholder="Например: чужая фотография"
                          className="mt-1 block w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
                        />
                      </label>
                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Отклонить
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Опубликованные</h2>
        {(listed ?? []).length === 0 ? (
          <p className="text-gray-500">Пока ни одной.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(listed ?? []).map((card) => (
              <li key={card.id} className="flex items-baseline justify-between gap-4">
                <Link href={`/gallery/${card.id}`} className="text-accent hover:underline">
                  {card.text?.slice(0, 60) || "без описания"}
                </Link>
                <span className="shrink-0 text-gray-400">
                  {card.profiles?.display_name || card.profiles?.email} ·{" "}
                  {formatPrice(card.price)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
