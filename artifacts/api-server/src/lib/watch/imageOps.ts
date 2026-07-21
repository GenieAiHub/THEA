import jpeg from "jpeg-js";

/** Planar-free packed RGB image (3 bytes/pixel). */
export interface RgbImage {
  data: Uint8Array;
  width: number;
  height: number;
}

const MAX_DECODE_MB = 1024;

/** Decode a JPEG buffer to packed RGB (alpha stripped). */
export function decodeJpegToRgb(jpegBuffer: Buffer): RgbImage {
  const decoded = jpeg.decode(jpegBuffer, { useTArray: true, maxMemoryUsageInMB: MAX_DECODE_MB });
  const { data, width, height } = decoded;
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i]!;
    rgb[j + 1] = data[i + 1]!;
    rgb[j + 2] = data[i + 2]!;
  }
  return { data: rgb, width, height };
}

/** Encode packed RGB back to JPEG. */
export function encodeRgbToJpeg(img: RgbImage, quality = 80): Buffer {
  const rgba = new Uint8Array(img.width * img.height * 4);
  for (let i = 0, j = 0; j < img.data.length; i += 4, j += 3) {
    rgba[i] = img.data[j]!;
    rgba[i + 1] = img.data[j + 1]!;
    rgba[i + 2] = img.data[j + 2]!;
    rgba[i + 3] = 255;
  }
  const encoded = jpeg.encode({ data: rgba, width: img.width, height: img.height }, quality);
  return Buffer.from(encoded.data);
}

/** Crop a region (clamped to image bounds). Returns null if the clamped region is degenerate. */
export function cropRgb(img: RgbImage, x: number, y: number, w: number, h: number): RgbImage | null {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(img.width, Math.ceil(x + w));
  const y1 = Math.min(img.height, Math.ceil(y + h));
  const cw = x1 - x0;
  const ch = y1 - y0;
  if (cw < 8 || ch < 8) return null;
  const out = new Uint8Array(cw * ch * 3);
  for (let row = 0; row < ch; row++) {
    const src = ((y0 + row) * img.width + x0) * 3;
    out.set(img.data.subarray(src, src + cw * 3), row * cw * 3);
  }
  return { data: out, width: cw, height: ch };
}

/** Nearest-neighbour resize. */
export function resizeRgb(img: RgbImage, newW: number, newH: number): RgbImage {
  const out = new Uint8Array(newW * newH * 3);
  for (let y = 0; y < newH; y++) {
    const sy = Math.min(img.height - 1, Math.floor((y * img.height) / newH));
    for (let x = 0; x < newW; x++) {
      const sx = Math.min(img.width - 1, Math.floor((x * img.width) / newW));
      const s = (sy * img.width + sx) * 3;
      const d = (y * newW + x) * 3;
      out[d] = img.data[s]!;
      out[d + 1] = img.data[s + 1]!;
      out[d + 2] = img.data[s + 2]!;
    }
  }
  return { data: out, width: newW, height: newH };
}

/**
 * Grayscale + linear contrast stretch (2nd–98th percentile) to help OCR on
 * small licence-plate crops. Output stays packed RGB (all channels equal).
 */
export function grayscaleStretch(img: RgbImage): RgbImage {
  const n = img.width * img.height;
  const gray = new Uint8Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < n; i++, j += 3) {
    const g = Math.round(0.299 * img.data[j]! + 0.587 * img.data[j + 1]! + 0.114 * img.data[j + 2]!);
    gray[i] = g;
    hist[g] = (hist[g] ?? 0) + 1;
  }
  let lo = 0;
  let hi = 255;
  let acc = 0;
  const loCut = n * 0.02;
  const hiCut = n * 0.98;
  for (let v = 0; v < 256; v++) {
    acc += hist[v]!;
    if (acc <= loCut) lo = v;
    if (acc <= hiCut) hi = v;
  }
  const range = Math.max(1, hi - lo);
  const out = new Uint8Array(n * 3);
  for (let i = 0, j = 0; i < n; i++, j += 3) {
    const v = Math.max(0, Math.min(255, Math.round(((gray[i]! - lo) * 255) / range)));
    out[j] = v;
    out[j + 1] = v;
    out[j + 2] = v;
  }
  return { data: out, width: img.width, height: img.height };
}
