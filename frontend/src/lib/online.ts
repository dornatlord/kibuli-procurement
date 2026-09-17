import { useEffect, useState } from "react";

// Whether the app can reach its server. The browser's own flag only knows
// whether the computer is on a network; Wi-Fi with no internet behind it (no
// data bundle, a router that's down) shows up as requests failing, which
// api.ts reports here.
let serverReachable = true;
const CONNECTION_EVENT = "kibuli:connection";

export function reportServerReachable(reachable: boolean) {
  if (serverReachable === reachable) return;
  serverReachable = reachable;
  window.dispatchEvent(new Event(CONNECTION_EVENT));
}

export const isServerReachable = () => serverReachable;

/** Whether the app can talk to its server, kept up to date as that changes. */
export function useOnline() {
  const read = () => navigator.onLine && serverReachable;
  const [online, setOnline] = useState(read);
  useEffect(() => {
    const update = () => setOnline(read());
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener(CONNECTION_EVENT, update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener(CONNECTION_EVENT, update);
    };
  }, []);
  return online;
}
