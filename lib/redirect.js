import { NextResponse } from "next/server";

// За обратным прокси (nginx в Timeweb Cloud App Platform) приложение видит
// запрос как http://localhost:3000/... — настоящий домен до Node не доходит.
// Поэтому `new URL(path, request.url)` давал абсолютный Location на localhost,
// и после входа браузер уходил на localhost:3000/admin.

// Для API-роутов отдаём относительный Location: браузер разрешает его от адреса,
// который сам запросил, то есть от реального домена. Так редирект работает и за
// прокси, и локально, и не зависит от заголовков хостинга.
// RFC 7231 §7.1.2 относительный Location разрешает.
export function redirectTo(path, { status = 307 } = {}) {
  return new NextResponse(null, { status, headers: { Location: path } });
}

// В middleware так нельзя: Next.js сам разбирает Location через `new URL()` и
// на относительном падает с ERR_INVALID_URL. Здесь собираем абсолютный адрес из
// заголовков X-Forwarded-*, которые проставляет прокси. Если их нет (локальный
// запуск) — остаётся адрес самого запроса.
export function redirectFromMiddleware(request, path) {
  const target = new URL(path, request.nextUrl);
  const host = firstValue(request.headers.get("x-forwarded-host"));
  if (host) {
    const proto = firstValue(request.headers.get("x-forwarded-proto")) || "https";
    return NextResponse.redirect(`${proto}://${host}${target.pathname}${target.search}`);
  }
  return NextResponse.redirect(target);
}

// Прокси могут выстраивать заголовок цепочкой: "site.ru, internal.local".
function firstValue(header) {
  return header ? header.split(",")[0].trim() : null;
}
