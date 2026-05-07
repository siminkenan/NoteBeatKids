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
  const plugins: Plugin[] = [suppressPostcssFromWarning(), ...(react() as Plugin[])];

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
      // 'safari12' hedefi: esbuild'in optional chaining (?.), nullish coalescing (??)
      // ve diğer modern söz dizimlerini eski tarayıcılar için transpile etmesini sağlar.
      // iOS 12 Safari + Android 8 Chrome bu sayede çalışır.
      target: "safari12",
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          // Büyük paketleri ayrı chunk'lara böl:
          // - İlk yükleme daha hızlı (sadece gereken parça yüklenir)
          // - Tarayıcı cache'i daha verimli kullanır
          manualChunks: {
            "vendor-react":  ["react", "react-dom"],
            "vendor-motion": ["framer-motion"],
            "vendor-query":  ["@tanstack/react-query"],
            "vendor-ui":     ["@radix-ui/react-dialog", "@radix-ui/react-tooltip"],
          },
        },
      },
    },
  };
});
