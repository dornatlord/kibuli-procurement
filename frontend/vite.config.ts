import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { KSS_BADGE_SVG } from "./src/lib/badge";

/**
 * Fills in the two things index.html can't know by itself: the school badge for
 * the splash, and a content security policy naming the API this build talks to,
 * so the page may only load its own files, its typeface and that API.
 */
function indexHtmlExtras(): Plugin {
  let apiOrigin = "";
  return {
    name: "kibuli-index-html",
    configResolved(config) {
      const api = config.env.VITE_API_URL || "";
      apiOrigin = api.startsWith("http") ? new URL(api).origin : "";
    },
    transformIndexHtml: (html) =>
      html
        .replace("<!-- kss-badge -->", KSS_BADGE_SVG)
        .replace(
          "<!-- kss-csp -->",
          `<meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; base-uri 'self'; object-src 'none'; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; connect-src 'self'${
        apiOrigin ? ` ${apiOrigin}` : ""
      }; form-action 'self'"
    />`
        ),
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
  plugins: [react(), indexHtmlExtras(), serviceWorker()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
