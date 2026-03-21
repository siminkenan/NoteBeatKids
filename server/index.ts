import express from "express";
import path from "path";

const app = express();

// JSON middleware
app.use(express.json());

// TEST API
app.get("/api/test", (req, res) => {
  res.json({ message: "API çalışıyor 🚀" });
});

// STATIC FILES (Vite build sonrası)
const __dirname = new URL(".", import.meta.url).pathname;
const distPath = path.join(__dirname, "../dist/public");

app.use(express.static(distPath));

// SPA fallback (React Router için)
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// 🔥 RENDER PORT FIX (EN KRİTİK KISIM)
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
