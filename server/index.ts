import path from "path";
import { fileURLToPath } from "url";
import { createApp, log } from "./app";
import { serveStatic } from "./static";
import { storage } from "./storage";

// ES Module uyumlu __dirname tanımı
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  const { app, httpServer } = await createApp();

  if (process.env.NODE_ENV === "production") {
    // public dizini ES Module uyumlu path ile
    const publicPath = path.join(__dirname, "../dist/public");
    serveStatic(app, publicPath);
  } else {
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