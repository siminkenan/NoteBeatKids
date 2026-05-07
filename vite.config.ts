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
      // 'safari12' hedefi: optional chaining (?.), nullish coalescing (??)
      // ve diğer modern söz dizimlerini eski tarayıcılar için transpile eder.
      // iOS 12 Safari + Android 8 Chrome bu sayede çalışır.
      target: "safari12",
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      // Chunk uyarı eşiğini artır — büyük app için makul
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Fonksiyon formu: Rollup'un modül ID'lerine göre chunk ataması yapar.
          // String-obje formu bazen boş chunk üretir (vendor-react 0 kB sorunu);
          // fonksiyon formu bu hatayı giderir.
          manualChunks(id: string) {
            if (!id.includes("/node_modules/")) return;

            // React çekirdeği — her zaman ayrı chunk
            if (
              id.includes("/node_modules/react/") ||
              id.includes("/node_modules/react-dom/") ||
              id.includes("/node_modules/scheduler/")
            ) {
              return "vendor-react";
            }

            // Framer Motion — büyük animasyon kütüphanesi
            if (id.includes("/node_modules/framer-motion/")) {
              return "vendor-motion";
            }

            // TanStack React Query
            if (id.includes("/node_modules/@tanstack/")) {
              return "vendor-query";
            }

            // Radix UI bileşenleri
            if (id.includes("/node_modules/@radix-ui/")) {
              return "vendor-ui";
            }

            // Recharts + D3 — sadece class-detail'de kullanılır
            if (
              id.includes("/node_modules/recharts/") ||
              id.includes("/node_modules/d3-") ||
              id.includes("/node_modules/d3/") ||
              id.includes("/node_modules/victory-vendor/")
            ) {
              return "vendor-charts";
            }

            // VexFlow — müzik notasyon motoru, ayrı büyük chunk
            if (id.includes("/node_modules/vexflow/")) {
              return "vendor-vexflow";
            }

            // QR kod kütüphaneleri
            if (
              id.includes("/node_modules/qrcode") ||
              id.includes("/node_modules/html5-qrcode")
            ) {
              return "vendor-qr";
            }

            // Zod + React Hook Form
            if (
              id.includes("/node_modules/zod/") ||
              id.includes("/node_modules/@hookform/") ||
              id.includes("/node_modules/react-hook-form/")
            ) {
              return "vendor-forms";
            }
          },
        },
      },
    },
  };
});
