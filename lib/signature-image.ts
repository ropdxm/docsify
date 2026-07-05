// Pure validation helpers for uploaded signature images. Separate from the
// server action so they can be unit-tested ("use server" modules may only
// export async actions).

/** Encoded size cap. Must stay below serverActions.bodySizeLimit so the
 *  friendly error is reachable (the framework rejects bigger bodies first). */
export const MAX_SIGNATURE_BYTES = 1024 * 1024; // 1 МБ

// Decoded-size caps: a 1 MB PNG can decompress to gigapixels, and LibreOffice
// rasterizes the image on every PDF conversion - on SHARED converter
// infrastructure. Generous for a signature, fatal for a pixel bomb.
const MAX_SIDE_PX = 4000;
const MAX_TOTAL_PX = 4_000_000; // ~4 МП

export type SignatureImage = {
  extension: "png" | "jpg";
  contentType: string;
  width: number;
  height: number;
};

/**
 * Sniffs the real file type from magic bytes (browsers mislabel, extensions
 * lie) and reads the decoded dimensions from the header. Returns null for
 * anything that is not a sanely-sized PNG or JPEG.
 */
export function validateSignatureImage(bytes: Buffer): SignatureImage | null {
  const dims = isPng(bytes)
    ? pngDimensions(bytes)
    : isJpeg(bytes)
      ? jpegDimensions(bytes)
      : null;
  if (!dims) return null;
  const { width, height } = dims;
  if (
    width < 1 ||
    height < 1 ||
    width > MAX_SIDE_PX ||
    height > MAX_SIDE_PX ||
    width * height > MAX_TOTAL_PX
  ) {
    return null;
  }
  return isPng(bytes)
    ? { extension: "png", contentType: "image/png", width, height }
    : { extension: "jpg", contentType: "image/jpeg", width, height };
}

function isPng(b: Buffer): boolean {
  return (
    b.length > 24 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47
  );
}

function isJpeg(b: Buffer): boolean {
  return b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}

// PNG: IHDR is required to be the first chunk - width/height at fixed offsets.
function pngDimensions(b: Buffer): { width: number; height: number } | null {
  if (b.length < 24) return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

// JPEG: walk the segment markers until a start-of-frame (SOFn) header, which
// carries the decoded dimensions.
function jpegDimensions(b: Buffer): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = b[i + 1];
    // Standalone markers without a length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (i + 4 > b.length) return null;
    const size = b.readUInt16BE(i + 2);
    if (size < 2) return null;
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isSof) {
      if (i + 9 > b.length) return null;
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + size;
  }
  return null;
}
