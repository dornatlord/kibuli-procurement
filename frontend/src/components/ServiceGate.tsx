import { useEffect, useState } from "react";
import { PAUSED_EVENT } from "../lib/api";

const BASE = import.meta.env.VITE_API_URL || "/api";

type Status =
  | { state: "ok" }
  | { state: "notice"; text: string; contact: string | null }
  | { state: "warning"; pauseAt: string; minutesLeft: number; message: string; contact: string | null }
  | { state: "paused"; message: string; contact: string | null };

/**
 * Tells everyone when access to the system is about to be paused or has been:
 * a red warning with a countdown, a one-day reminder, or a full-screen notice
 * that replaces the app. The server decides; this only asks and shows.
 */
export default function ServiceGate() {
  const [status, setStatus] = useState<Status>({ state: "ok" });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (!navigator.onLine) return;
      try {
        const res = await fetch(`${BASE}/service-status`, { cache: "no-store" });
        if (res.ok && !stopped) setStatus(await res.json());
      } catch {
        // Unreachable: leave what is showing as it is.
      }
    };
    void check();
    const timer = setInterval(check, 20000);
    const onPaused = () => void check();
    window.addEventListener(PAUSED_EVENT, onPaused);
    window.addEventListener("online", onPaused);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener(PAUSED_EVENT, onPaused);
      window.removeEventListener("online", onPaused);
    };
  }, []);

  // The countdown ticks between checks.
  useEffect(() => {
    if (status.state !== "warning") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status.state]);

  if (status.state === "ok") return null;

  if (status.state === "paused") {
    return (
      <div role="alertdialog" aria-modal="true" aria-label="Access paused" className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-50 px-6">
        <div className="max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg">
          <h1 className="text-xl font-semibold text-gray-900">Access to the system is paused</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">{status.message}</p>
          {status.contact && <p className="mt-3 text-sm font-medium text-gray-900">{status.contact}</p>}
          <p className="mt-4 text-xs text-gray-500">Nothing has been deleted. Everything is back as soon as access is restored.</p>
        </div>
      </div>
    );
  }

  if (status.state === "warning") {
    const left = Math.max(0, new Date(status.pauseAt).getTime() - now);
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    return (
      <div role="alert" className="sticky top-0 z-[70] bg-red-700 px-4 py-2.5 text-center text-sm text-white shadow-md">
        <span className="font-semibold">
          Access to the system will be paused in {m}:{String(s).padStart(2, "0")}.
        </span>{" "}
        {status.message} Save any work you are in the middle of now.
        {status.contact && <span className="ml-1 font-medium">{status.contact}</span>}
      </div>
    );
  }

  return (
    <div role="alert" className="sticky top-0 z-[70] bg-amber-500 px-4 py-2.5 text-center text-sm font-medium text-amber-950 shadow-md">
      {status.text}
      {status.contact && <span className="ml-1">{status.contact}</span>}
    </div>
  );
}
