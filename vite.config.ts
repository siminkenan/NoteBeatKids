import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

function suppressPostcssFromWarning(): Plugin {
  return {
    name: "suppress-postcss-from-warning",
    enforce: "pre",
    configResolved() {
      const _warn = console.warn.bind(console);
      console.warn = (...args: unknown[]) => {
        const msg = typeof args[0] === "string" ? args[0] : "";
        if (msg.includes("PostCSS") && msg.includes("`from`")) return;
        _warn(...args);
      };
    },
  };
}

export default defineConfig(async () => {
  const plugins: Plugin[] = [suppressPostcssFromWarning(), react()];

  return {
    plugins,
    css: {
      postcss: {
        plugins: [tailwindcss(), autoprefixer()],
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
  };
});
