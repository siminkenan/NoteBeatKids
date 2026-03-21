import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// __dirname fix (ESM için gerekli)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// build edilen frontend yolu
const publicPath = path.join(__dirname, "../dist/public");

// static serve
app.use(express.static(publicPath));

// fallback (SPA için)
app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// port
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
