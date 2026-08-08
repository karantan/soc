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

const isDevelopment = process.env.NODE_ENV === "development";
const devToolbar = { enabled: isDevelopment };

// https://astro.build/config
export default defineConfig({
  site: "http://localhost:4321",
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
