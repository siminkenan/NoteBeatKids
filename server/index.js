const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());

// test endpoint
app.get("/api/test", (req, res) => {
  res.json({ message: "API çalışıyor 🚀" });
});

// static files
const distPath = path.join(__dirname, "../dist/public");
app.use(express.static(distPath));

// react fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// PORT FIX (EN KRİTİK)
const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
