import Link from "next/link";
import CardTile from "@/components/CardTile";
import SetupNotice from "@/components/SetupNotice";
import { formatPrice } from "@/lib/format";
import {
  getSupabase,
  isSupabaseConfigured,
  missingSupabaseEnv,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = { title: "Галерея" };

export default async function GalleryPage() {
  const heading = <h1 className="text-2xl font-semibold">Галерея</h1>;

  if (!isSupabaseConfigured) {
    return (
      <section className="space-y-4">
        {heading}
        <SetupNotice missing={missingSupabaseEnv()} />
      </section>
    );
  }

  const supabase = getSupabase();
  // Только опубликованные: private и pending видит лишь автор, rejected —
  // автор и админ.
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, preview_url, image_url, text, price, profiles(display_name)")
    .eq("status", "listed")
    .order("listed_at", { ascending: false })
    .limit(60);

  const list = cards ?? [];

  return (
    <section className="space-y-6">
      {heading}
      <p className="max-w-2xl text-sm text-gray-500">
        Карты, которые нарисовали посетители сайта. Здесь они показаны с
        водяным знаком; покупатель получает карту без него, в полном размере.
      </p>

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Не удалось загрузить галерею: {error.message}
        </p>
      )}

      {!error && list.length === 0 && (
        <p className="text-gray-500">
          Пока пусто.{" "}
          <Link href="/generate" className="text-accent hover:underline">
            Нарисуйте карту
          </Link>{" "}
          и выставьте её первой — цена от {formatPrice(300)}.
        </p>
      )}

      {list.length > 0 && (
        <div className="grid grid-cols-2 items-start gap-4 sm:grid-cols-4">
          {list.map((card) => (
            <Link key={card.id} href={`/gallery/${card.id}`} className="group block">
              <CardTile card={card} ratio="auto" />
              <p className="mt-1 flex items-baseline justify-between text-sm">
                <span className="font-medium text-accent">
                  {formatPrice(card.price)}
                </span>
                <span className="text-gray-400 group-hover:text-accent">
                  {card.profiles?.display_name || "Автор"}
                </span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
