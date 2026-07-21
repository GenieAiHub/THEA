---
name: Security Watch live streaming (DVR/IP cams)
description: On-demand RTSP→HLS live streaming design rules + how to E2E-test RTSP locally
---

# Live streaming session manager (api-server lib/watch/liveStream.ts)

- One shared ffmpeg HLS session per camera (keyed by cameraId) under /tmp/thea-watch-live/<id>/. H.264 sources remux with `-c:v copy`; others transcode to 720p H.264. Audio dropped.
- **The idle reaper is the ONLY authoritative teardown** (60s since last playlist/segment fetch). POST /stream/stop must NOT tear down immediately — it only ages `lastAccess` so the reaper collects it. Sessions are shared: immediate teardown kills playback for other viewers of the same camera.
- **Concurrent starts must be guarded synchronously**: `inFlightStarts` promise map set before the first await. Without it, two simultaneous starts spawn two ffmpeg writers into the same dir; the loser leaks (invisible to the reaper) and corrupts the playlist. Capacity check counts sessions + in-flight starts.
- Stream file serving: strict name whitelist (`^[A-Za-z0-9_-]+\.(m3u8|ts|m4s|mp4)$`) before path join; org check is in-memory against session.orgId (no DB hit per segment). Rate limiter must skip stream paths (HLS = ~1 req/2s per viewer, default limiter dies in minutes).
- DVR brands (lib/watch/dvr.ts): URL templates for hikvision/dahua/uniview/amcrest/reolink + generic `{channel}` pattern; host rejected if it contains `/`, `@`, or spaces; creds URL-encoded and masked in all API responses. /dvr/test + /dvr/import are owner/admin only (accepted SSRF-to-LAN trade-off).

# E2E-testing RTSP in this workspace

**Why:** background processes started in one agent bash session are reaped when the session exits — `nohup setsid` does NOT survive.
**How to apply:** run the whole test inside ONE bash command: start `mediamtx` (binary downloadable from GitHub releases into /tmp; needs a config with `paths: all_others:` or it rejects unconfigured paths) + an ffmpeg lavfi publisher with SHORT GOP (`-g 5`, else HLS start waits ~50s for a keyframe), then curl the API, then kill both. Shell and workflows share the network — 127.0.0.1 works both ways.
