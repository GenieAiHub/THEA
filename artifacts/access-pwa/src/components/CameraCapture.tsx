import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CameraError,
  captureFrameBase64,
  startCamera,
  stopCamera,
} from "@/lib/camera";

interface CameraCaptureProps {
  open: boolean;
  title?: string;
  hint?: string;
  facingMode?: "user" | "environment";
  busy?: boolean;
  onClose: () => void;
  onCapture: (base64: string) => void;
}

export function CameraCapture({
  open,
  title = "Position the face in frame",
  hint = "Hold steady and make sure the face is well lit.",
  facingMode = "user",
  busy = false,
  onClose,
  onCapture,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    stopCamera(streamRef.current);
    streamRef.current = null;
    setReady(false);
  }, []);

  const begin = useCallback(async () => {
    setError(null);
    setReady(false);
    try {
      const stream = await startCamera(facingMode);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setReady(true);
      }
    } catch (err) {
      setError(
        err instanceof CameraError
          ? err.message
          : "Couldn't start the camera. Please try again.",
      );
    }
  }, [facingMode]);

  useEffect(() => {
    if (open) {
      void begin();
    } else {
      stop();
    }
    return stop;
  }, [open, begin, stop]);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const base64 = captureFrameBase64(videoRef.current);
    if (!base64) {
      setError("Couldn't capture the frame. Try again.");
      return;
    }
    onCapture(base64);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{title}</p>
          <p className="truncate text-xs text-white/60">{hint}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/10"
          onClick={onClose}
          disabled={busy}
          data-testid="button-camera-close"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
        />
        {/* Framing guide */}
        {ready && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="aspect-square w-[68%] max-w-xs rounded-full border-2 border-primary/70 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]" />
          </div>
        )}
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Starting camera…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center text-white">
            <Camera className="h-10 w-10 text-white/50" />
            <p className="text-sm text-white/80">{error}</p>
            <Button variant="secondary" onClick={begin}>
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing…
          </div>
        )}
      </div>

      <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-5">
        <Button
          size="lg"
          className="h-16 w-full rounded-2xl text-base font-semibold"
          onClick={handleCapture}
          disabled={!ready || busy || !!error}
          data-testid="button-camera-capture"
        >
          <Camera className="mr-2 h-5 w-5" />
          Capture
        </Button>
      </div>
    </div>
  );
}
