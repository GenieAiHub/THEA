/**
 * Web camera helpers built on getUserMedia + a canvas. All face matching
 * happens on the backend — the client only captures a downscaled JPEG.
 */

export class CameraError extends Error {
  kind: "denied" | "unsupported" | "notfound" | "unknown";
  constructor(
    kind: "denied" | "unsupported" | "notfound" | "unknown",
    message: string,
  ) {
    super(message);
    this.kind = kind;
    this.name = "CameraError";
  }
}

export function isCameraSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

/**
 * Requests the camera stream. `facingMode` defaults to the front camera, which
 * is what you want for a face scan / self check-in.
 */
export async function startCamera(
  facingMode: "user" | "environment" = "user",
): Promise<MediaStream> {
  if (!isCameraSupported()) {
    throw new CameraError(
      "unsupported",
      "This browser can't access the camera. Try Safari (iOS) or Chrome (Android).",
    );
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
  } catch (err) {
    const name = (err as DOMException)?.name ?? "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new CameraError(
        "denied",
        "Camera access was blocked. Enable it in your browser settings, then try again.",
      );
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      throw new CameraError("notfound", "No camera was found on this device.");
    }
    throw new CameraError(
      "unknown",
      "Couldn't start the camera. Please try again.",
    );
  }
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Grabs the current video frame, downscales it to a network-friendly JPEG and
 * returns the raw base64 payload (no data-URL prefix) that the API expects.
 */
export function captureFrameBase64(
  video: HTMLVideoElement,
  maxWidth = 512,
): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const scale = Math.min(1, maxWidth / vw);
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : null;
}
