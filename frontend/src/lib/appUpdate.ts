import { useSyncExternalStore } from "react";

/**
 * Knows when a new version of the system has been deployed while a page is
 * open. The service worker saves each new version by itself and takes over
 * open pages, but a page keeps running the version it loaded until it is
 * reloaded: so the page shows a notice asking the user to update.
 */

let ready = false;
const listeners = new Set<() => void>();

function announce() {
  ready = true;
  listeners.forEach((listener) => listener());
}

/** True once a newer version than the one running is ready. */
export function useUpdateReady(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => ready
  );
}

/** How often an open page asks whether there's a new version. */
const CHECK_EVERY = 15 * 60 * 1000;
/** Coming back to the page asks again, but not more than once a minute. */
const RECHECK_AFTER = 60 * 1000;

/**
 * Watches for new versions: a newer service worker taking charge of the page
 * means one has been saved. Browsers only look for one when a page loads, so
 * a page left open asks every so often, and whenever it's looked at again or
 * the connection comes back.
 */
export function watchForUpdates(registration: ServiceWorkerRegistration) {
  const workers = navigator.serviceWorker;
  // The first worker taking charge of a page is the app being saved, not an update.
  let controlled = !!workers.controller;
  workers.addEventListener("controllerchange", () => {
    if (controlled) announce();
    controlled = true;
  });

  let lastCheck = Date.now();
  const check = () => {
    lastCheck = Date.now();
    registration.update().catch(() => {
      // Offline, or the server is starting up: the next check tries again.
    });
  };
  setInterval(check, CHECK_EVERY);
  const checkSoon = () => {
    if (Date.now() - lastCheck > RECHECK_AFTER) check();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkSoon();
  });
  window.addEventListener("online", checkSoon);
}

/** Loads the new version. */
export function updateNow() {
  window.location.reload();
}
