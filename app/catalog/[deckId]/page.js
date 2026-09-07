import Link from "next/link";
import { notFound } from "next/navigation";
import CardTile from "@/components/CardTile";
import SetupNotice from "@/components/SetupNotice";
import SubmitButton from "@/components/SubmitButton";
import { recordInterest, saveContact } from "../actions";
import { TARIFFS } from "@/lib/tariffs";
import { currentProfile } from "@/lib/account";
import { formatPrice, pluralCards } from "@/lib/format";
import { imageSrc } from "@/lib/storage";
import {
  getSupabase,
  isSupabaseConfigured,
  missingSupabaseEnv,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function DeckPage({ params, searchParams }) {
  if (!isSupabaseConfigured) {
    return <SetupNotice missing={missingSupabaseEnv()} />;
  }

  const supabase = getSupabase();
  const { data: deck, error } = await supabase
    .from("decks")
    .select("id, title, description, price, cover_image")
    .eq("id", params.deckId)
    .maybeSingle();

  // Несуществующий или некорректный id — обычная 404, а не ошибка сервера.
  if (error || !deck) notFound();

  const { data: cards } = await supabase
    .from("cards")
    .select("id, image_url, text, price")
    .eq("deck_id", deck.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const list = cards ?? [];

  // Кто вошёл — тому подставим его почту в поле контакта: набирать её заново
  // ради заявки незачем.
  const profile = await currentProfile();

  const lead = searchParams?.lead;
  const tariff = TARIFFS[searchParams?.tariff] ? searchParams.tariff : null;

  return (
    <article className="space-y-8">
      <Link href="/catalog" className="text-sm text-gray-500 hover:text-accent">
        ← Каталог
      </Link>

      <header className="flex flex-col gap-6 sm:flex-row">
        <div className="w-full shrink-0 overflow-hidden rounded-xl bg-cardBg sm:w-56">
          {deck.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc(deck.cover_image)}
              alt={deck.title}
              className="aspect-[3/4] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center text-sm text-gray-400">
              без обложки
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-semibold">{deck.title}</h1>
          {deck.description && <p className="text-gray-600">{deck.description}</p>}
          <p className="text-sm text-gray-400">{pluralCards(list.length)}</p>
          <p className="text-xl font-medium text-accent">{formatPrice(deck.price)}</p>

          {/* Настоящей оплаты за кнопками нет: Этап 4 выясняет спрос — по
              каким колодам и за какой тариф вообще нажимают. */}
          <div className="space-y-3 pt-2">
            {searchParams?.error && (
              <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                {searchParams.error}
              </p>
            )}

            {searchParams?.thanks ? (
              <p className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
                Спасибо! Напишем, как только оплату можно будет провести.
              </p>
            ) : lead ? (
              <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                <div>
                  <p className="font-medium">Скоро будет доступно</p>
                  <p className="text-sm text-gray-600">
                    {tariff ? TARIFFS[tariff] : "Покупка колоды"} пока не
                    оплачивается на сайте. Оставьте почту или телефон — сообщим,
                    когда откроем оплату.
                  </p>
                </div>

                <form action={saveContact} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="deck" value={deck.id} />
                  <input type="hidden" name="lead" value={lead} />
                  <input
                    name="contact"
                    required
                    defaultValue={profile?.email ?? ""}
                    placeholder="почта или телефон"
                    className="min-w-[12rem] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <SubmitButton pendingLabel="Сохраняю…">Сообщить мне</SubmitButton>
                </form>

                <p className="text-xs text-gray-400">
                  Контакт нужен только для одного письма об открытии оплаты.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <form action={recordInterest}>
                  <input type="hidden" name="deck" value={deck.id} />
                  <input type="hidden" name="tariff" value="deck" />
                  <SubmitButton pendingLabel="Секунду…">Купить колоду</SubmitButton>
                </form>

                <form action={recordInterest}>
                  <input type="hidden" name="deck" value={deck.id} />
                  <input type="hidden" name="tariff" value="subscription" />
                  <button
                    type="submit"
                    className="rounded-lg border border-accent px-5 py-2.5 text-accent hover:bg-accent/10"
                  >
                    Подписка на все колоды
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      <section>
        <h2 className="mb-4 text-lg font-medium">Карты в колоде</h2>
        {list.length === 0 ? (
          <p className="text-gray-500">В этой колоде пока нет карт.</p>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            {list.map((card) => (
              <CardTile key={card.id} card={card} />
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
