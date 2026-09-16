import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let offer: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// Chrome and Edge offer installation once, early; hold on to the offer so the
// "Install the app" button can use it later. Imported from main.tsx for that reason.
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  offer = event as InstallPromptEvent;
  notify();
});
window.addEventListener("appinstalled", () => {
  offer = null;
  notify();
});

/** Whether the browser offers to install the app, and a way to accept. */
export function useInstallPrompt() {
  const [available, setAvailable] = useState(() => offer !== null);

  useEffect(() => {
    const update = () => setAvailable(offer !== null);
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);

  async function install() {
    if (!offer) return;
    await offer.prompt();
    await offer.userChoice;
    offer = null;
    notify();
  }

  return { available, install };
}
