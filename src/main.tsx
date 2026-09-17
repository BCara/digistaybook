import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { preconnectFunctions } from "./lib/firebase";
import "./styles.css";

// The wall read is the request the guest waits on: start the connection to
// the callable region while the page is still drawing.
preconnectFunctions();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
