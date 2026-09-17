import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useOfflineWork } from "../lib/offlineWork";
import { AlertIcon, CheckCircleIcon, ProgressIcon, WifiOffIcon, XIcon } from "./icons";

const TONES = {
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-red-200 bg-red-50 text-red-800",
  blue: "border-blue-200 bg-blue-50 text-blue-900",
  green: "border-green-200 bg-green-50 text-green-900",
};

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "today at 14:32", "yesterday at 09:05", "12 Sep at 16:40". */
function when(time: number) {
  const date = new Date(time);
  const clock = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(time).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return `today at ${clock}`;
  if (days === 1) return `yesterday at ${clock}`;
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at ${clock}`;
}

/** Working without internet: what still works, what's waiting, and what was sent. */
export default function OfflineNotices() {
  const { online, queued, sent, dismissSent, savedAt } = useOfflineWork();
  const failed = queued.filter((q) => q.error).length;
  const sending = online && queued.length - failed > 0;

  return (
    <>
      {!online && (
        <Notice tone="amber" icon={<WifiOffIcon />}>
          <p>
            <span className="font-semibold">{navigator.onLine ? "Can't reach the server." : "You're offline."}</span>{" "}
            You can still open what's saved on this computer and fill in new requests, which are sent when
            you're back online. Approvals, LPOs and other changes need the internet.
          </p>
          <p className="mt-1 text-amber-800">
            {savedAt ? `Saved on this computer ${when(savedAt)}.` : "Nothing has been saved for offline use yet."}
            {queued.length > 0 && ` ${count(queued.length, "request")} waiting to be sent.`}
          </p>
        </Notice>
      )}

      {sending && (
        <Notice tone="blue" icon={<ProgressIcon className="animate-spin" />}>
          <p>Sending {count(queued.length - failed, "request")} filled in offline…</p>
        </Notice>
      )}

      {online && failed > 0 && (
        <Notice tone="red" icon={<AlertIcon />}>
          <p>
            {count(failed, "request")} filled in offline couldn't be sent.{" "}
            <Link to="/requests" className="font-semibold underline underline-offset-2">
              See why
            </Link>
          </p>
        </Notice>
      )}

      {sent.length > 0 && (
        <Notice tone="green" icon={<CheckCircleIcon />} onDismiss={dismissSent}>
          <p>
            <span className="font-semibold">Sent {count(sent.length, "request")} filled in offline.</span>{" "}
            {sent.length === 1
              ? "It's saved as a draft: open it to check it and submit it."
              : "They're saved as drafts: open each one to check it and submit it."}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {sent.map((s) => (
              <li key={s.id}>
                <Link to={`/requests/${s.id}`} className="font-mono text-xs font-semibold underline underline-offset-2">
                  {s.referenceNumber ?? `Request ${s.id}`}
                </Link>{" "}
                {s.subject}
              </li>
            ))}
          </ul>
        </Notice>
      )}
    </>
  );
}

function Notice({
  tone,
  icon,
  onDismiss,
  children,
}: {
  tone: keyof typeof TONES;
  icon: ReactNode;
  onDismiss?: () => void;
  children: ReactNode;
}) {
  return (
    <div role="status" className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${TONES[tone]}`}>
      <span className="mt-0.5 shrink-0 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
