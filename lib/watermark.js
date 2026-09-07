import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Превью — уменьшенная копия карты с водяным знаком. Именно она показывается
// всем, кроме владельца и покупателя; оригинал лежит в закрытом бакете.
//
// Знак накладывается здесь, на сервере, и становится частью пикселей. Класть
// полупрозрачный логотип поверх картинки в вёрстке бесполезно: такой слой
// снимается в браузере за десять секунд, и защиты в нём нет никакой.
const MAX_SIDE = 700;

// Плитка со знаком лежит готовой картинкой в public/watermark.png. Рисовать
// надпись на сервере нельзя: в контейнере может не быть ни одного шрифта, и
// текст вышел бы пустотой. Когда заказчица согласует логотип — заменить файл,
// код не трогать.
let tile = null;

async function watermarkTile() {
  if (!tile) tile = await readFile(path.join(process.cwd(), "public", "watermark.png"));
  return tile;
}

export async function makePreview(buffer) {
  const mark = await watermarkTile();

  return sharp(buffer)
    .resize({
      width: MAX_SIDE,
      height: MAX_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    // tile: true — знак повторяется по всей площади, а не стоит в углу:
    // угловой обрезается кадрированием за секунду.
    .composite([{ input: mark, tile: true, blend: "over" }])
    .jpeg({ quality: 82, progressive: true })
    .toBuffer();
}

export const PREVIEW_UPLOAD = { contentType: "image/jpeg", extension: "jpg" };
