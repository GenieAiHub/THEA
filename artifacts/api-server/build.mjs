import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const localRequire = createRequire(import.meta.url);

// @tensorflow/tfjs' package "main" resolves to dist/tf.node.js which requires the
// native tfjs-node binding (unavailable on this env). Redirect the bare specifier
// to the pure-JS UMD build (CPU backend) at build time so face-api + our own code
// both bundle against it.
const TFJS_BROWSER = localRequire.resolve("@tensorflow/tfjs/dist/tf.js");

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      // NOTE: do NOT externalize "@tensorflow/tfjs" — it must be bundled with the
      // build-time alias below so its bad "main" (tf.node.js -> native tfjs-node)
      // is replaced by the pure-JS CPU build. The wasm backend + (absent) native
      // node backend stay external so they're required from node_modules at runtime.
      "@tensorflow/tfjs-node",
      "@tensorflow/tfjs-node-gpu",
      "@tensorflow/tfjs-backend-wasm",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
      "crawlee",
      "@crawlee/*",
      "got-scraping",
      "got",
      "fingerprint-generator",
      "fingerprint-injector",
      "header-generator",
      "franc",
      "franc-min",
      "trigram-utils",
      "n-gram",
      "telegram",
      "pdfkit",
      "pptxgenjs",
    ],
    alias: {
      "@tensorflow/tfjs": TFJS_BROWSER,
    },
    sourcemap: "linked",
    plugins: [
      // tfjs' UMD build contains a dead-code `require('node-fetch')` (only reached
      // when the global fetch is absent — Node 20 provides it, and we load models
      // from disk anyway). tfjs does not declare node-fetch as a resolvable dep, so
      // esbuild can't bundle it. Stub it ONLY when imported from @tensorflow/* — real
      // consumers like telegraf keep their bundled node-fetch.
      {
        name: "stub-tfjs-node-fetch",
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /^node-fetch$/ }, (args) => {
            if (args.importer.includes(`${path.sep}@tensorflow${path.sep}`)) {
              return { path: args.path, namespace: "tfjs-node-fetch-stub" };
            }
            return undefined;
          });
          pluginBuild.onLoad({ filter: /.*/, namespace: "tfjs-node-fetch-stub" }, () => ({
            contents:
              "const f = (...a) => globalThis.fetch(...a); module.exports = f; module.exports.default = f;",
            loader: "js",
          }));
        },
      },
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
