import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// A tab opened before a deploy still runs the old build, whose lazy chunks no longer exist on the
// server: reload once to pick up the new build instead of showing a blank page. The timestamp
// guard stops a reload loop if the chunk is genuinely missing.
window.addEventListener("vite:preloadError", (event) => {
  const last = Number(sessionStorage.getItem("chunk-reload-at") ?? 0);
  if (Date.now() - last < 10_000) return;
  event.preventDefault();
  sessionStorage.setItem("chunk-reload-at", String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
