import Link from "next/link";
import { redirect } from "next/navigation";
import CardTile from "@/components/CardTile";
import SetupNotice from "@/components/SetupNotice";
import { logoutAction } from "./actions";
import { currentProfile } from "@/lib/account";
import {
  getSupabase,
  isSupabaseConfigured,
  missingSupabaseEnv,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = { title: "Мой кабинет" };

export default async function AccountPage() {
  if (!isSupabaseConfigured) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Мой кабинет</h1>
        <SetupNotice missing={missingSupabaseEnv()} />
      </section>
    );
  }

  const profile = await currentProfile();
  // Проверка именно здесь, а не только в middleware: до страницы с чужими
  // данными подделанный заголовок дотянуться не должен.
  if (!profile) redirect("/login?from=%2Faccount");

  const supabase = getSupabase();
  const { data: cards } = await supabase
    .from("cards")
    .select("id, image_url, text")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  const mine = cards ?? [];

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Мой кабинет</h1>
          <p className="text-sm text-gray-500">{profile.email}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-accent hover:text-accent"
          >
            Выйти
          </button>
        </form>
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-medium">Мои карты</h2>
          <Link href="/generate" className="text-sm text-accent hover:underline">
            Сгенерировать ещё
          </Link>
        </div>

        {mine.length === 0 ? (
          <p className="text-sm text-gray-500">
            Пока пусто.{" "}
            <Link href="/generate" className="text-accent hover:underline">
              Нарисуйте первую карту
            </Link>{" "}
            — она сохранится здесь.
          </p>
        ) : (
          <div className="grid grid-cols-2 items-start gap-4 sm:grid-cols-4">
            {mine.map((card) => (
              <CardTile key={card.id} card={card} ratio="auto" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
