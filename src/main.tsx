import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import { preconnectFunctions } from "./lib/firebase";
import "./styles.css";
import { localTest } from "./lib/firebaseConfig";

if (localTest) {
  const banner = document.createElement("div");
  banner.className = "local-test-banner";
  banner.innerHTML = 'TEST ENVIRONMENT · Local data only · <a href="/__test">Accounts and test guide</a>';
  // The guide is a separate document served by Vite, outside the app router.
  banner.querySelector("a")!.addEventListener("click", event => event.stopPropagation());
  document.body.prepend(banner);
}

// A deploy removes the previous build's chunks, so a page loaded before it
// fails on its next lazy import. Reload once to pick up the new build.
window.addEventListener("vite:preloadError", event => {
  const key = "reloadedForPreloadError";
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  event.preventDefault();
  window.location.reload();
});
window.addEventListener("load", () => setTimeout(() => sessionStorage.removeItem("reloadedForPreloadError"), 10000));

// The wall read is the request the guest waits on: start the connection to
// the callable region while the page is still drawing.
preconnectFunctions();

// The marketing pages arrive prerendered (tools/prerender.mjs) and are
// hydrated; every other address arrives as the empty shell and is drawn here.
const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
