import { createRequire } from "node:module";
import Module from "node:module";

/**
 * DEV-runtime shim. `@tensorflow/tfjs` resolves (via its package "main") to
 * dist/tf.node.js, which requires the native `@tensorflow/tfjs-node` binding that
 * is unavailable in this environment. We redirect the bare specifier to the
 * pure-JS UMD build (CPU backend) so that both our own code and @vladmandic/face-api's
 * internal `require("@tensorflow/tfjs")` resolve to it.
 *
 * In the production esbuild bundle a build-time alias (see build.mjs) does the same
 * job, so this runtime hook is only exercised under `tsx` in development. It is a
 * harmless no-op in the bundle (nothing requires the bare specifier at runtime).
 *
 * IMPORTANT: this module must be imported BEFORE @vladmandic/face-api so the hook is
 * installed before face-api's top-level require runs.
 */
const req = createRequire(import.meta.url);

let tfBrowserPath: string | null = null;
try {
  tfBrowserPath = req.resolve("@tensorflow/tfjs/dist/tf.js");
} catch {
  tfBrowserPath = null;
}

if (tfBrowserPath) {
  const ModuleAny = Module as unknown as {
    _resolveFilename: (request: string, ...rest: unknown[]) => string;
  };
  const original = ModuleAny._resolveFilename;
  ModuleAny._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]): string {
    if (request === "@tensorflow/tfjs") {
      return original.call(this, tfBrowserPath as string, ...rest);
    }
    return original.call(this, request, ...rest);
  };
}
