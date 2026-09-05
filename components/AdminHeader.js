import Link from "next/link";

export default function AdminHeader({ title, backHref, backLabel }) {
  return (
    <div className="mb-6 space-y-2">
      {backHref && (
        <Link href={backHref} className="text-sm text-gray-500 hover:text-accent">
          ← {backLabel}
        </Link>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <form action="/api/admin/logout" method="post">
          <button type="submit" className="text-sm text-gray-400 hover:text-accent">
            Выйти
          </button>
        </form>
      </div>
    </div>
  );
}
