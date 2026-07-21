---
name: Security Watch recognition pipeline
description: Camera/watch-target recognition design — plate OCR tricks, sampler constraints, upload cleanup
---

# Security Watch (cameras, targets, sightings)

- Plate OCR (tesseract.js): OCR splits plates into tokens — join sliding windows of 2-3 adjacent tokens before matching; fold ambiguous chars (O↔0, I↔1, B↔8, S↔5, G↔6) on BOTH sides. **Raw crops often read better than preprocessed ones** — OCR the raw crop AND a grayscale contrast-stretched variant, union the candidates. Also crop a lower-half band per detected vehicle.
- Object/vehicle matching: coco-ssd detect → crop → mobilenet embedding → cosine vs reference images. Load weights via fs IOHandler from vendored `artifacts/api-server/models/`; never the patched @tensorflow/tfjs bundle (shared tfjs-core engine).
- Camera sampler is **in-process** (setInterval + ffmpeg spawn): running multiple api-server replicas would duplicate sampling. Fine for single-VPS; revisit if scaling out.
- Camera stream URLs deliberately allow private/LAN IPs (self-hosted product, admin-only mutation) — this is a documented trade-off, not an SSRF oversight. streamUrl is visible to all org members (masking creds for viewers = open follow-up).
- Upload lifecycle: busboy 500MB cap → /tmp/thea-watch-videos → worker deletes file + nulls filePath in finally. Orphans (client abort, crash pre-row) are unlinked on req "close" (check `!req.readableEnded`) + hourly sweep that skips filePaths still referenced in watch_video_jobs.

**Why:** each of these was reached after failed simpler attempts (preprocessing-only OCR failed; naive per-token plate match failed).
