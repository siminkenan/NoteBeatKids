import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// build path
const publicPath = path.join(__dirname, "../dist/public");

// static files
app.use(express.static(publicPath));

// SPA fallback (FIXED)
app.get("/*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
