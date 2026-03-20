import express from "express";

const app = express();

// basit test endpoint
app.get("/", (req, res) => {
  res.send("Server çalışıyor 🚀");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});