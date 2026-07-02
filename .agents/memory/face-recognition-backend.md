---
name: face-recognition-backend
description: How to run face recognition in the Node api-server on this NixOS env (for the mobile face-scan feature)
---

# Backend face recognition (THEA mobile face-scan)

Face matching happens in the **backend** (api-server), not on-device: there is no
face API via Replit external_apis, and Expo Go blocks native ML libraries. Mobile
sends a JPEG; backend computes a 128-d descriptor and matches via pgvector L2 distance.

## What works (proven by spike)
- Stack: `@vladmandic/face-api` + `@tensorflow/tfjs` (pure JS) + `@tensorflow/tfjs-backend-wasm` + `jpeg-js`.
- Decode JPEG with `jpeg-js` → strip alpha → `tf.tensor3d(rgb, [h,w,3])` → `detectSingleFace(tensor, new TinyFaceDetectorOptions({inputSize:416, scoreThreshold:0.4})).withFaceLandmarks().withFaceDescriptor()`.
- Models loaded via `faceapi.nets.<net>.loadFromDisk(dir)` from downloaded weight files (tinyFaceDetector, faceLandmark68Net, faceRecognitionNet) in `artifacts/api-server/models/`.
- Descriptor is a 128-length Float32Array. Distances: **same person ≈0.06, different ≈0.81**. Threshold ~0.5–0.6 separates cleanly.

## Critical gotchas
- **`@tensorflow/tfjs-node` native binding fails on NixOS** (`tfjs_binding.node` not found) — do NOT use it. Use pure-JS/WASM only.
- `@tensorflow/tfjs` `main` field resolves to `dist/tf.node.js`, which `require`s the missing tfjs-node. Must redirect `@tensorflow/tfjs` → its pure-JS build. In plain node use a `Module._resolveFilename` hook to an **absolute** `require.resolve("@tensorflow/tfjs/dist/tf.js")` (pnpm isolation breaks subpath redirects that keep the caller's parent). In the esbuild bundle (build.mjs) use an alias instead.
- Use vladmandic's `dist/face-api.node-wasm.js` entry (has `loadFromDisk`; the browser `esm.js` does not). It does NOT auto-select a backend, so call `tf.setBackend(...)` + `tf.ready()` yourself.
- UMD `tf.js` bundles its own core → the separately-imported wasm backend won't attach to it. For WASM you need the modular `dist/index.js` build so `@tensorflow/tfjs-core` dedups. CPU backend works fine with UMD `tf.js` and is the reliable baseline (~4s first detect incl. warmup).
- pnpm ignores build scripts by default (that's why tfjs-node's postinstall was skipped) — fine, since we avoid native builds.
