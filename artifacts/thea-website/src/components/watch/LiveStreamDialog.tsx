import React, { useEffect, useRef, useState } from "react";
import { useStartWatchCameraStream, useStopWatchCameraStream } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 20; // ~40s — transcoding sources can take a while to produce a playlist

interface LiveStreamDialogProps {
  camera: { id: string; name: string } | null;
  onClose: () => void;
}

/**
 * On-demand HLS live view. Polls the start endpoint until the server reports
 * "live", then attaches hls.js (or native HLS on Safari) to the playlist.
 * The server reaps the session ~60s after the last segment fetch, so closing
 * the dialog only needs a best-effort stop.
 */
export function LiveStreamDialog({ camera, onClose }: LiveStreamDialogProps) {
  const startStream = useStartWatchCameraStream();
  const stopStream = useStopWatchCameraStream();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [phase, setPhase] = useState<"connecting" | "playing" | "error">("connecting");
  const [error, setError] = useState<string>("");
  const [transcoding, setTranscoding] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (!camera) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const attach = async (playlistUrl: string) => {
      const video = videoRef.current;
      if (!video || cancelled) return;
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari — native HLS; same-origin URL so cookies flow automatically
        video.src = playlistUrl;
        await video.play().catch(() => undefined);
        if (!cancelled) setPhase("playing");
        return;
      }
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (!Hls.isSupported()) {
        setError("This browser cannot play HLS streams.");
        setPhase("error");
        return;
      }
      const hls = new Hls({
        liveDurationInfinity: true,
        xhrSetup: (xhr: XMLHttpRequest) => { xhr.withCredentials = true; },
      });
      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_evt: unknown, data: { fatal: boolean; details: string }) => {
        if (data.fatal && !cancelled) {
          setError(`Playback failed (${data.details}).`);
          setPhase("error");
        }
      });
      hls.loadSource(playlistUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => undefined);
        if (!cancelled) setPhase("playing");
      });
    };

    const poll = async (n: number) => {
      if (cancelled) return;
      setAttempt(n);
      try {
        const result: any = await startStream.mutateAsync({ id: camera.id });
        if (cancelled) return;
        setTranscoding(Boolean(result?.transcoding));
        if (result?.status === "live") {
          await attach(result.playlistUrl);
          return;
        }
        if (n >= MAX_POLLS) {
          setError("The stream did not become ready in time. The camera may be slow or unreachable.");
          setPhase("error");
          return;
        }
        timer = setTimeout(() => poll(n + 1), POLL_INTERVAL_MS);
      } catch (err: any) {
        if (cancelled) return;
        const status = err?.response?.status;
        const message = err?.response?.data?.error || err?.message || "Could not start the live stream.";
        if (status === 429 || status === 502 || status === 503 || status === 404) {
          setError(message);
          setPhase("error");
          return;
        }
        if (n >= MAX_POLLS) {
          setError(message);
          setPhase("error");
          return;
        }
        timer = setTimeout(() => poll(n + 1), POLL_INTERVAL_MS);
      }
    };

    setPhase("connecting");
    setError("");
    setTranscoding(false);
    void poll(1);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      // Best-effort teardown — the server-side idle reaper is authoritative
      stopStream.mutate({ id: camera.id });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera?.id, runId]);

  /** Re-runs the connect effect from scratch (cleanup destroys the old player). */
  const retry = () => setRunId((n) => n + 1);

  return (
    <Dialog open={!!camera} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 max-w-3xl" data-testid="dialog-live-stream">
        <DialogHeader>
          <DialogTitle className="text-slate-100 flex items-center gap-2">
            Live — {camera?.name}
            {phase === "playing" && (
              <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30 animate-pulse">LIVE</Badge>
            )}
            {transcoding && (
              <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30">transcoding</Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Streams stop automatically about a minute after you close this window.
          </DialogDescription>
        </DialogHeader>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-slate-800 bg-black">
          <video ref={videoRef} className="h-full w-full" controls muted playsInline data-testid="video-live-stream" />
          {phase === "connecting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <p className="text-slate-300 text-sm">Connecting to camera… ({attempt})</p>
              {transcoding && <p className="text-slate-500 text-xs">Converting the stream for browser playback — this can take a little longer.</p>}
            </div>
          )}
          {phase === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
              <p className="text-red-400 text-sm" data-testid="text-stream-error">{error}</p>
              <Button variant="outline" size="sm" className="border-slate-700 text-slate-300" onClick={retry} data-testid="button-stream-retry">
                <RefreshCw className="w-4 h-4 mr-1.5" /> Try again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
