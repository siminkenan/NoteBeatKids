import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// __dirname fix (ESM için)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PORT (Render için zorunlu)
const PORT = process.env.PORT || 10000;

// static build klasörü
const distPath = path.join(__dirname, "../dist/public");

app.use(express.static(distPath));

// React / Vite fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// 🔥 KRİTİK: 0.0.0.0 kullan
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
