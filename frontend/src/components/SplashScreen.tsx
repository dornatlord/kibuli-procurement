import { useEffect, useState } from "react";
import { KSS_BADGE } from "../lib/badge";

// Shown while the app checks who is signed in. It is the splash from
// index.html (styled there) taken over by React, so the two must stay alike.
// Render's free server sleeps when unused and can take up to a minute to wake,
// so a long wait says what is happening instead of looking stuck.
const HINTS: [number, string][] = [
  [0, "Loading…"],
  [5000, "Connecting…"],
  [15000, "Still starting up. After a quiet spell this can take up to a minute."],
];

/** Times are from when the page started opening, so the index.html splash counts too. */
const hintAt = (ms: number) => HINTS.filter(([after]) => ms >= after).pop()![1];

export default function SplashScreen() {
  const [hint, setHint] = useState(() => hintAt(performance.now()));
  // Carry on the progress bar's movement from the index.html splash.
  const [barDelay] = useState(() => `-${Math.round(performance.now() % 1300)}ms`);

  useEffect(() => {
    const timers = HINTS.map(([after, text]) =>
      setTimeout(() => setHint(text), Math.max(0, after - performance.now()))
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="kss-splash" role="status">
      <div className="kss-splash-tile" aria-hidden="true">
        <img src={KSS_BADGE} alt="" />
      </div>
      <div className="kss-splash-name">Kibuli Secondary School</div>
      <div className="kss-splash-sub">Procurement System</div>
      <div className="kss-splash-bar" aria-hidden="true">
        <span style={{ animationDelay: barDelay }} />
      </div>
      <div className="kss-splash-hint">{hint}</div>
    </div>
  );
}
