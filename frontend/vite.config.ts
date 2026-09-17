import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { KSS_BADGE_SVG } from "./src/lib/badge";

/** Draws the school badge into the index.html splash, from the app's one copy of it. */
function splashBadge(): Plugin {
  return {
    name: "kibuli-splash-badge",
    transformIndexHtml: (html) => html.replace("<!-- kss-badge -->", KSS_BADGE_SVG),
  };
}

/**
 * Builds /sw.js from sw/service-worker.js, filling in every file the app needs
 * to open offline and a version that changes whenever any of them does, so an
 * installed app picks up each deploy.
 */
function serviceWorker(): Plugin {
  let root = "";
  let publicDir = "";

  return {
    name: "kibuli-service-worker",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      root = config.root;
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const template = readFileSync(resolve(root, "sw/service-worker.js"), "utf8");
      const version = createHash("sha256").update(template);
      const files: string[] = [];

      for (const item of Object.values(bundle)) {
        if (item.fileName.endsWith(".map")) continue;
        files.push(`/${item.fileName}`);
        version.update(item.fileName);
        version.update(item.type === "chunk" ? item.code : item.source);
      }

      for (const path of listFiles(publicDir)) {
        const name = relative(publicDir, path).split("\\").join("/");
        // Host settings such as _redirects aren't part of the app.
        if (name.startsWith("_") || name.startsWith(".")) continue;
        files.push(`/${name}`);
        version.update(name);
        version.update(readFileSync(path));
      }

      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: template
          .replace("__VERSION__", version.digest("hex").slice(0, 12))
          .replace("__PRECACHE__", JSON.stringify(files.sort(), null, 2)),
      });
    },
  };
}

function listFiles(dir: string): string[] {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

export default defineConfig({
  plugins: [react(), splashBadge(), serviceWorker()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
