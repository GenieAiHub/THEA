import { franc } from "franc";

const FRANC_TO_ISO2: Record<string, string> = {
  eng: "en", zho: "zh", cmn: "zh", yue: "zh", jpn: "ja", kor: "ko",
  tha: "th", ara: "ar", heb: "he", rus: "ru", hin: "hi", tam: "ta",
  mal: "ml", ben: "bn", ell: "el", msa: "ms", zsm: "ms", ind: "id",
  deu: "de", fra: "fr", spa: "es", por: "pt", ita: "it", nld: "nl",
  pol: "pl", ukr: "uk", vie: "vi", tur: "tr", swe: "sv", nor: "no",
  dan: "da", fin: "fi", ces: "cs", slk: "sk", ron: "ro", hrv: "hr",
  bul: "bg", hun: "hu", afr: "af", swh: "sw", amh: "am", hau: "ha",
  yor: "yo", ibo: "ig", fas: "fa", urd: "ur", pnb: "pa", guj: "gu",
  mar: "mr", kan: "kn", tel: "te", sin: "si", mya: "my", khm: "km",
  lao: "lo", nep: "ne", som: "so", cat: "ca",
};

export function detectLanguage(text: string): string {
  if (!text || text.length < 20) return "en";
  const code = franc(text.slice(0, 1000), { minLength: 10 });
  if (code === "und") return "en";
  return FRANC_TO_ISO2[code] ?? code.slice(0, 2);
}
