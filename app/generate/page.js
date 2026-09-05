import CardTile from "@/components/CardTile";
import Field from "@/components/Field";
import SetupNotice from "@/components/SetupNotice";
import SubmitButton from "@/components/SubmitButton";
import {
  STYLES,
  isFusionBrainConfigured,
  missingFusionBrainEnv,
} from "@/lib/fusionbrain";
import {
  PER_SESSION_PER_DAY,
  generationsTableReady,
  ipHash,
  readSessionId,
  remainingGenerations,
} from "@/lib/generation-limit";
import {
  getSupabase,
  isSupabaseConfigured,
  missingSupabaseEnv,
} from "@/lib/supabase";
import { generateCard } from "./actions";

// Результат зависит от cookie посетителя и от базы — кэшировать нечего.
export const dynamic = "force-dynamic";

export const metadata = { title: "Сгенерировать карту" };

export default async function GeneratePage({ searchParams }) {
  const heading = <h1 className="text-2xl font-semibold">Сгенерировать свою карту</h1>;

  if (!isSupabaseConfigured) {
    return (
      <section className="space-y-4">
        {heading}
        <SetupNotice missing={missingSupabaseEnv()} />
      </section>
    );
  }

  if (!isFusionBrainConfigured) {
    return (
      <section className="space-y-4">
        {heading}
        <SetupNotice
          missing={missingFusionBrainEnv()}
          title="Генерация ещё не подключена"
        >
          <p>
            Ключи выдаются в личном кабинете{" "}
            <a className="underline" href="https://fusionbrain.ai/keys/">
              fusionbrain.ai
            </a>{" "}
            и добавляются в переменные окружения на хостинге. Подробности — в
            README, раздел «Генерация карт».
          </p>
        </SetupNotice>
      </section>
    );
  }

  const supabase = getSupabase();

  if (!(await generationsTableReady(supabase))) {
    return (
      <section className="space-y-4">
        {heading}
        <SetupNotice title="Журнал генераций ещё не создан в базе">
          <p>
            Выполните <code>supabase/schema.sql</code> в Supabase → SQL Editor →
            New query. Скрипт можно запускать повторно: существующие таблицы он
            не трогает, добавит только недостающую <code>generations</code>.
          </p>
        </SetupNotice>
      </section>
    );
  }

  const session = readSessionId();
  const left = await remainingGenerations(supabase, { session, ip: ipHash() });

  const error = searchParams?.error;
  const justCreatedId = searchParams?.card;

  const { data: justCreated } = justCreatedId
    ? await supabase
        .from("cards")
        .select("id, image_url, text")
        .eq("id", justCreatedId)
        .maybeSingle()
    : { data: null };

  const { data: history } = session
    ? await supabase
        .from("generations")
        .select("id, cards(id, image_url, text)")
        .eq("session_id", session)
        .order("created_at", { ascending: false })
        .limit(8)
    : { data: null };

  const earlier = (history ?? [])
    .map((row) => row.cards)
    .filter((card) => card && card.id !== justCreatedId);

  return (
    <section className="space-y-8">
      {heading}

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {justCreated && (
        <div className="space-y-3">
          <h2 className="font-medium">Ваша карта готова</h2>
          <div className="max-w-xs">
            <CardTile card={justCreated} />
          </div>
        </div>
      )}

      <form action={generateCard} className="max-w-xl space-y-4">
        <Field
          label="Опишите карту"
          hint="Чем подробнее описание, тем ближе результат. До 500 символов."
          required
        >
          <textarea
            name="prompt"
            rows={4}
            maxLength={500}
            required
            placeholder="Например: одинокое дерево на берегу озера в утреннем тумане, мягкий свет, акварель"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </Field>

        <Field label="Стиль">
          <select
            name="style"
            defaultValue="DEFAULT"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            {STYLES.map((style) => (
              <option key={style.id} value={style.id}>
                {style.title}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-center gap-4">
          <SubmitButton pendingLabel="Рисую, до минуты…">
            Сгенерировать
          </SubmitButton>
          <span className="text-sm text-gray-500">
            {left > 0
              ? `Осталось генераций сегодня: ${left} из ${PER_SESSION_PER_DAY}`
              : "Лимит на сегодня исчерпан — возвращайтесь завтра"}
          </span>
        </div>
      </form>

      {earlier.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium">Сгенерировано раньше</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {earlier.map((card) => (
              <CardTile key={card.id} card={card} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
