import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
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

// The wall read is the request the guest waits on: start the connection to
// the callable region while the page is still drawing.
preconnectFunctions();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
