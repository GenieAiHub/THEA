/**
 * Native share via the Web Share API with graceful fallbacks.
 *
 * navigator.share opens the OS share sheet (Android, iOS Safari, some desktop).
 * When it's unavailable or fails we fall back to copying the URL/text to the
 * clipboard so the action never silently does nothing.
 */

export type ShareResult = "shared" | "copied" | "cancelled" | "unavailable";

export interface ShareInput {
  title?: string;
  text?: string;
  url?: string;
}

export function isShareSupported(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.share === "function"
  );
}

export function isClipboardSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  );
}

export async function share(input: ShareInput): Promise<ShareResult> {
  if (isShareSupported()) {
    try {
      await navigator.share(input);
      return "shared";
    } catch (err) {
      // AbortError = the user dismissed the sheet; that's a cancel, not a failure.
      if ((err as DOMException)?.name === "AbortError") return "cancelled";
      // Any other error falls through to the clipboard fallback below.
    }
  }
  const text = input.url ?? input.text ?? "";
  if (text && isClipboardSupported()) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      return "unavailable";
    }
  }
  return "unavailable";
}
