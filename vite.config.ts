import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "emulator" ? [{
    name: "local-test-guide",
    transformIndexHtml: () => [{ tag: "meta", attrs: { name: "digistaybook-environment", content: "test" }, injectTo: "head" as const }],
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/__test", (_request, response) => {
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(readFileSync("docs/local-test.html", "utf8"));
      });
    }
  }] : [])],
  server: { watch: { ignored: ["**/.local-test/**", "**/firebase-export-*/**"] } },
  test: {
    exclude: [...configDefaults.exclude, "docs/legal-review/**", "tmp/**"],
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    coverage: {
      reporter: ["text", "json-summary"]
    }
  }
}));
