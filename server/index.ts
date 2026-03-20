import { createApp, log } from "./app";
import { serveStatic } from "./static";
import { storage } from "./storage";
import path from "path";

(async () => {
  const { app, httpServer } = await createApp();

  if (process.env.NODE_ENV === "production") {
    // production modda build edilmiş client dosyalarını serve et
    const publicPath = path.join(__dirname, "../dist/public");
    serveStatic(app, publicPath);
  } else {
    // development modda Vite ile client'ı çalıştır
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    { port, host: "0.0.0.0", reusePort: true },
    async () => {
      log(`serving on port ${port}`);
      try {
        await storage.seedData();
        log("Database seeded successfully");
      } catch (e: any) {
        log(`Seed error: ${e.message}`);
      }
    },
  );
})();