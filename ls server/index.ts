import express from "express";

const app = express();

// Basit test endpoint
app.get("/", (req, res) => {
  res.send("Server çalışıyor 🚀");
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Render için port ayarı
const PORT = process.env.PORT || 3000;

// Her yerden erişim için host 0.0.0.0
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
