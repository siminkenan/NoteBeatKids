import { createApp, log } from "./app";
import { serveStatic } from "./static";
import { storage } from "./storage";

(async () => {
  const { app, httpServer } = await createApp();

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
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
