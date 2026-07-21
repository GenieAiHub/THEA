---
name: Security Watch recognition pipeline
description: Camera/watch-target recognition design — plate OCR tricks, sampler constraints, upload cleanup
---

# Security Watch (cameras, targets, sightings)

- Plate OCR (tesseract.js): OCR splits plates into tokens — join sliding windows of 2-3 adjacent tokens before matching; fold ambiguous chars (O↔0, I↔1, B↔8, S↔5, G↔6) on BOTH sides. **Raw crops often read better than preprocessed ones** — OCR the raw crop AND a grayscale contrast-stretched variant, union the candidates. Also crop a lower-half band per detected vehicle.
- Object/vehicle matching: coco-ssd detect → crop → mobilenet embedding → cosine vs reference images. Load weights via fs IOHandler from vendored `artifacts/api-server/models/`; never the patched @tensorflow/tfjs bundle (shared tfjs-core engine).
- Camera sampler is in-process but multi-replica safe: a Redis leader lock (SET NX PX + Lua renew/release, 30s TTL / 10s renew) ensures only one replica samples; losing the lock stops local runners. FAILS CLOSED on Redis errors — a leader only rides out errors within a TTL grace window, and never after Redis positively confirms lock loss (renew=0).
- Camera stream URLs deliberately allow private/LAN IPs (self-hosted product, admin-only mutation) — this is a documented trade-off, not an SSRF oversight. streamUrl is visible to all org members (masking creds for viewers = open follow-up).
- Live-camera path verified end-to-end against a real RTSP stream (mediamtx + ffmpeg loop): online/error/recovery health transitions, sightings, and per-(target,camera) Redis cooldown all behave. Two gotchas: (1) startup bootstrap can exhaust the DB pool — sampler start must retry with backoff or one timeout permanently disables live monitoring; (2) test streams need short GOP (`-g 5`), otherwise single-frame grabs wait ~50s for a keyframe and hit the 12s ffmpeg timeout.
- Upload lifecycle: busboy 500MB cap → /tmp/thea-watch-videos → worker deletes file + nulls filePath in finally. Orphans (client abort, crash pre-row) are unlinked on req "close" (check `!req.readableEnded`) + hourly sweep that skips filePaths still referenced in watch_video_jobs.

**Why:** each of these was reached after failed simpler attempts (preprocessing-only OCR failed; naive per-token plate match failed).
