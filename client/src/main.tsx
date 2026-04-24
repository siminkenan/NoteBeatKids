import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { LiteModeProvider } from "./lib/liteMode";

createRoot(document.getElementById("root")!).render(
  <LiteModeProvider>
    <App />
  </LiteModeProvider>
);

// Splash ekranını React ilk render'dan sonra gizle
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById("splash");
    if (splash) {
      splash.classList.add("hidden");
      setTimeout(() => splash.remove(), 450);
    }
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
