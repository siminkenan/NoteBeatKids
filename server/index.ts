import path from "path";
import { fileURLToPath } from "url";
import { createApp, log } from "./app";
import { serveStatic } from "./static";
import { storage } from "./storage";

// ES module'de __dirname tanımı
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  const { app, httpServer } = await createApp();

  if (process.env.NODE_ENV === "production") {
    // Production’da static dosyaları servis et
    serveStatic(app, path.join(__dirname, "../dist/public"));
  } else {
    // Development’da Vite üzerinden live reload
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    { port, host: "0.0.0.0", reusePort: true },
    async () => {
      log(`Server is running on port ${port}`);
      try {
        await storage.seedData();
        log("Database seeded successfully");
      } catch (e: any) {
        log(`Seed error: ${e.message}`);
      }
    },
  );
})();