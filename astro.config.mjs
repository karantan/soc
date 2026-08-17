// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import { imageService } from "@unpic/astro/service";
import { defineConfig as viteConfig } from "vite";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import favicons from "astro-favicons";
import pagefind from "astro-pagefind";
import { agentsSummary } from "@nuasite/agent-summary";
import astroAgentAnnotate from "astro-agent-annotate";
import cloudflare from "@astrojs/cloudflare";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { sep } from "node:path";

const isDevelopment = process.env.NODE_ENV === "development";
const devToolbar = { enabled: isDevelopment };

// Where the node_modules that actually serves this project lives. Run from a git
// worktree (.claude/worktrees/*) there is none inside the project root — module
// resolution walks up to the main checkout's, which is outside Vite's default
// `fs.allow`, so island runtime files (@astrojs/react/dist/client.js) 403 in dev
// and every `client:*` component silently stays un-hydrated.
function nodeModulesDir() {
  try {
    const resolved = realpathSync(
      createRequire(import.meta.url).resolve("astro"),
    );
    const marker = `${sep}node_modules${sep}`;
    const i = resolved.lastIndexOf(marker);
    return i === -1 ? null : resolved.slice(0, i + marker.length - 1);
  } catch {
    return null;
  }
}
const nodeModules = nodeModulesDir();

// https://astro.build/config
export default defineConfig({
  site: "https://soc-codex.gv-073.workers.dev",
  output: "static",
  trailingSlash: "always",
  image: { service: imageService() },
  integrations: [
    react(),
    sitemap(),
    agentsSummary(),
    pagefind(),
    ...(devToolbar.enabled ? [astroAgentAnnotate()] : []),
    favicons({
      input: "./src/assets/favicon.png",
      name: "SoC Codex",
      short_name: "SoC Codex",
    }),
  ],

  vite: viteConfig({
    cacheDir: ".astro/vite",
    // .devenv/.direnv symlink into the nix store, which contains symlink
    // loops (apple-sdk ncurses) that crash the file watcher with ELOOP
    server: {
      watch: { ignored: ["**/.devenv/**", "**/.direnv/**"] },
      fs: { allow: [".", ...(nodeModules ? [nodeModules] : [])] },
    },
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  }),

  build: {
    concurrency: 4,
  },

  server: { port: 4321, host: "0.0.0.0", allowedHosts: true },
  devToolbar,
  adapter: isDevelopment
    ? undefined
    : cloudflare({ imageService: "custom", prerenderEnvironment: "node" }),

  fonts: [
    {
      provider: fontProviders.google(),
      name: "Cinzel",
      cssVariable: "--font-cinzel",
      weights: ["400 900"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["Georgia", "serif"],
    },
    {
      provider: fontProviders.google(),
      name: "Spectral",
      cssVariable: "--font-spectral",
      weights: [300, 400, 500, 600, 700],
      styles: ["normal", "italic"],
      subsets: ["latin"],
      fallbacks: ["Georgia", "serif"],
    },
  ],
});
