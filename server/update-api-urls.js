import fs from "fs";
import path from "path";

const SRC_DIR = path.join(process.cwd(), "client", "src");

function walkDir(dir) {
  const files = [];
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx") || fullPath.endsWith(".js")) {
      files.push(fullPath);
    }
  });
  return files;
}

const files = walkDir(SRC_DIR);

files.forEach((file) => {
  let content = fs.readFileSync(file, "utf8");

  content = content.replace(
    /fetch\(\s*['"`]\/api\//g,
    'fetch(`${import.meta.env.VITE_API_URL}/api/'
  );

  content = content.replace(
    /axios\.(get|post|put|delete)\(\s*['"`]\/api\//g,
    'axios.$1(`${import.meta.env.VITE_API_URL}/api/'
  );

  fs.writeFileSync(file, content, "utf8");
});

console.log("Tüm API çağrıları VITE_API_URL ile güncellendi ✅");