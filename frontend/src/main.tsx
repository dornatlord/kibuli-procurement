import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./lib/install";
import { installFirstLetterCapitals } from "./lib/capitals";
import { watchForUpdates } from "./lib/appUpdate";
import "./index.css";

// What's typed into a text box starts with a capital letter.
installFirstLetterCapitals();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// The installed app keeps its own files on the device, so it opens without
// internet; each new version is saved the same way, and open pages are told.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(watchForUpdates)
      .catch(() => {});
  });
}
