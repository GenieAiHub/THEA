const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}]/u;
const HIRAGANA_RE = /[\u3041-\u3096]/;
const KATAKANA_RE = /[\u30a1-\u30fa]/;
const HANGUL_RE = /[\uac00-\ud7af\u1100-\u11ff]/;
const ARABIC_RE = /[\u0600-\u06ff\u0750-\u077f]/;
const DEVANAGARI_RE = /[\u0900-\u097f]/;
const CYRILLIC_RE = /[\u0400-\u04ff]/;
const THAI_RE = /[\u0e00-\u0e7f]/;
const TAMIL_RE = /[\u0b80-\u0bff]/;
const MALAYALAM_RE = /[\u0d00-\u0d7f]/;
const BENGALI_RE = /[\u0980-\u09ff]/;
const GREEK_RE = /[\u0370-\u03ff]/;
const HEBREW_RE = /[\u0590-\u05ff]/;

export function detectLanguage(text: string): string {
  if (!text || text.length < 5) return "en";
  const sample = text.slice(0, 500);

  if (THAI_RE.test(sample)) return "th";
  if (ARABIC_RE.test(sample)) return "ar";
  if (HEBREW_RE.test(sample)) return "he";
  if (CYRILLIC_RE.test(sample)) return "ru";
  if (DEVANAGARI_RE.test(sample)) return "hi";
  if (TAMIL_RE.test(sample)) return "ta";
  if (MALAYALAM_RE.test(sample)) return "ml";
  if (BENGALI_RE.test(sample)) return "bn";
  if (GREEK_RE.test(sample)) return "el";
  if (HANGUL_RE.test(sample)) return "ko";
  if (HIRAGANA_RE.test(sample) || KATAKANA_RE.test(sample)) return "ja";

  const cjkCount = (sample.match(CJK_RE) || []).length;
  if (cjkCount > 10) return "zh";

  const asciiCount = (sample.match(/[a-zA-Z]/g) || []).length;
  if (asciiCount > sample.length * 0.5) {
    const ms = /\b(yang|dan|untuk|dengan|adalah|dari|ini|tidak|ada|di)\b/gi;
    const id = /\b(dan|yang|untuk|dengan|adalah|dari|ini|tidak|ada|juga)\b/gi;
    if ((sample.match(ms) || []).length > 3) return "ms";
    if ((sample.match(id) || []).length > 3) return "id";
  }

  return "en";
}
