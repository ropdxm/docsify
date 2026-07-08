import path from "node:path";
import { createRequire } from "node:module";
import type { SKRSContext2D } from "@napi-rs/canvas";
import type { XlsxSignature } from "@/lib/xlsx/invoice";

// A round company seal («печать») auto-drawn from the owner's own requisites
// and stamped on the left М.П. of АВР/накладная PDFs. Everything here is a
// convenience facsimile of the owner's own seal on the owner's own document -
// like the uploaded signature - never a third party's mark.

const SEAL_COLOR = "#14357e"; // seal-ink blue
const CANVAS = 320; // 2x the placed size, for crisp text

// @napi-rs/canvas is a native addon. Load it lazily inside a guard so a
// missing/incompatible platform binary degrades to a seal-less PDF (fail-soft)
// rather than throwing at module-eval and 500-ing the entire PDF route.
const nodeRequire = createRequire(import.meta.url);
type CanvasModule = typeof import("@napi-rs/canvas");
let canvasMod: CanvasModule | null | undefined;
function loadCanvas(): CanvasModule | null {
  if (canvasMod !== undefined) return canvasMod;
  try {
    canvasMod = nodeRequire("@napi-rs/canvas") as CanvasModule;
  } catch {
    canvasMod = null;
  }
  return canvasMod;
}

// PT Sans, split by subset: the Latin file carries digits/punctuation, the
// Cyrillic file the letters. Listed together in `font`, canvas falls back
// per-glyph (Latin first), so "ИП «ЖДМ» БИН 050916501298" renders whole.
let fontsReady = false;
function ensureFonts(canvas: CanvasModule): boolean {
  if (fontsReady) return true;
  try {
    const dir = path.join(
      process.cwd(),
      "node_modules",
      "@fontsource",
      "pt-sans",
      "files"
    );
    const { GlobalFonts } = canvas;
    GlobalFonts.registerFromPath(path.join(dir, "pt-sans-latin-400-normal.woff2"), "SealL");
    GlobalFonts.registerFromPath(path.join(dir, "pt-sans-cyrillic-400-normal.woff2"), "SealC");
    GlobalFonts.registerFromPath(path.join(dir, "pt-sans-latin-700-normal.woff2"), "SealLB");
    GlobalFonts.registerFromPath(path.join(dir, "pt-sans-cyrillic-700-normal.woff2"), "SealCB");
    fontsReady = true;
    return true;
  } catch {
    return false;
  }
}
const REG = (px: number) => `${px}px SealL, SealC`;
const BOLD = (px: number) => `${px}px SealLB, SealCB`;

type StampCompany = {
  name: string;
  bin: string;
  address?: string | null;
};

const STREET_PREFIX = /^(ул|улица|пр|просп|проспект|мкр|мкрн|микрорайон|р-?н|район|д|дом|зд|здание|оф|офис|кв|квартира|пер|переулок|бул|бульвар|ш|шоссе|блок|уч)\.?\s/i;

/**
 * Best-effort city for the seal centre. Prefers an explicit «г. Город»/«город
 * Город» segment wherever it sits, else the first segment that is not a postal
 * index, the country, or a street/building. Returns "" when nothing fits (the
 * centre then simply omits the city line).
 */
function cityFromAddress(address?: string | null): string {
  if (!address) return "";
  const segments = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const seg of segments) {
    const m = seg.match(/^(?:г\.?|город)\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  for (const seg of segments) {
    if (/^\d{5,6}$/.test(seg)) continue; // postal index
    if (/казахстан/i.test(seg)) continue; // country (already on the bottom arc)
    if (/\d/.test(seg)) continue; // streets/buildings carry numbers
    if (STREET_PREFIX.test(seg)) continue;
    return seg;
  }
  return "";
}

/** Text laid clockwise across the top of the ring, upright and centred at 12 o'clock. */
function arcTop(ctx: SKRSContext2D, text: string, r: number, font: string) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((s, w) => s + w / r, 0);
  let a = -total / 2;
  for (let i = 0; i < chars.length; i++) {
    const wa = widths[i] / r;
    a += wa / 2;
    ctx.save();
    ctx.rotate(a);
    ctx.fillText(chars[i], 0, -r);
    ctx.restore();
    a += wa / 2;
  }
  ctx.restore();
}

/** Text laid across the bottom of the ring, upright and readable left-to-right. */
function arcBottom(ctx: SKRSContext2D, text: string, r: number, font: string) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((s, w) => s + w / r, 0);
  let a = total / 2;
  for (let i = 0; i < chars.length; i++) {
    const wa = widths[i] / r;
    a -= wa / 2;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, r);
    ctx.rotate(Math.PI);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    a -= wa / 2;
  }
  ctx.restore();
}

function drawStar(ctx: SKRSContext2D, x: number, y: number, outer: number) {
  const inner = outer * 0.45;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Largest arc font (≤ max) that keeps `text` within `maxAngle` radians at `r`. */
function fitArcFont(
  ctx: SKRSContext2D,
  text: string,
  r: number,
  maxPx: number,
  minPx: number,
  maxAngle: number,
  bold: boolean
): string {
  for (let px = maxPx; px >= minPx; px--) {
    const font = bold ? BOLD(px) : REG(px);
    ctx.font = font;
    const angle = [...text].reduce((s, c) => s + ctx.measureText(c).width / r, 0);
    if (angle <= maxAngle) return font;
  }
  return bold ? BOLD(minPx) : REG(minPx);
}

/** Largest bold font (≤ max) that keeps `text` within `maxWidth` px. */
function fitWidthFont(ctx: SKRSContext2D, text: string, maxWidth: number, maxPx: number, minPx: number): string {
  for (let px = maxPx; px >= minPx; px--) {
    ctx.font = BOLD(px);
    if (ctx.measureText(text).width <= maxWidth) return BOLD(px);
  }
  return BOLD(minPx);
}

/**
 * Renders the round seal to a PNG. Returns null on any failure (missing native
 * binary, font, etc.) so the PDF still downloads - just without the stamp.
 */
export function generateStampPng(company: StampCompany): XlsxSignature | null {
  if (!company.name || !company.bin) return null;
  const canvas = loadCanvas();
  if (!canvas) return null;
  if (!ensureFonts(canvas)) return null;

  try {
    const cv = canvas.createCanvas(CANVAS, CANVAS);
    const ctx = cv.getContext("2d");
    const cx = CANVAS / 2;
    const cy = CANVAS / 2;

    ctx.translate(cx, cy);
    ctx.rotate((-4 * Math.PI) / 180); // slight hand-stamped tilt
    ctx.translate(-cx, -cy);

    ctx.strokeStyle = SEAL_COLOR;
    ctx.fillStyle = SEAL_COLOR;

    // Concentric rings: bold outer rim, a thin inner line closing the text
    // band, and the centre circle. Tight spacing keeps the seal from reading
    // as mostly empty.
    const rOuter = 153;
    const rMid = 118;
    const rInner = 96;
    for (const [r, lw] of [
      [rOuter, 3.4],
      [rMid, 1.5],
      [rInner, 2.2],
    ] as const) {
      ctx.beginPath();
      ctx.lineWidth = lw;
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    const rText = (rOuter + rMid) / 2 + 2;

    // Ring text (relative to centre).
    ctx.save();
    ctx.translate(cx, cy);
    const nameFont = fitArcFont(ctx, company.name, rText, 30, 12, 2.85, true);
    arcTop(ctx, company.name, rText, nameFont);
    const bottom = "РЕСПУБЛИКА КАЗАХСТАН";
    const bottomFont = fitArcFont(ctx, bottom, rText, 17, 10, 2.85, false);
    arcBottom(ctx, bottom, rText, bottomFont);
    // Seam stars at 3 and 9 o'clock.
    drawStar(ctx, rText, 0, 7.5);
    drawStar(ctx, -rText, 0, 7.5);
    ctx.restore();

    // Centre block: city / БИН label / number.
    const city = cityFromAddress(company.address);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (city) {
      ctx.font = fitWidthFont(ctx, city.toUpperCase(), 2 * rInner - 34, 18, 10);
      ctx.fillText(city.toUpperCase(), cx, cy - 26);
    }
    ctx.beginPath();
    ctx.lineWidth = 1.2;
    ctx.moveTo(cx - 52, cy - 6);
    ctx.lineTo(cx + 52, cy - 6);
    ctx.stroke();
    ctx.font = REG(11);
    ctx.fillText("БИН/ИИН", cx, cy + 10);
    ctx.font = fitWidthFont(ctx, company.bin, 2 * rInner - 30, 19, 12);
    ctx.fillText(company.bin, cx, cy + 32);

    return { data: cv.toBuffer("image/png"), extension: "png" };
  } catch {
    return null;
  }
}
