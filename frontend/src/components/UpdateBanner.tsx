import { updateNow, useUpdateReady } from "../lib/appUpdate";

/**
 * The red notice across the top of every page once a new version of the
 * system has been put online, asking the user to update. Updating reloads
 * the page, so it asks them to save first rather than doing it by itself.
 */
export default function UpdateBanner() {
  const ready = useUpdateReady();
  if (!ready) return null;
  return (
    <div
      role="alert"
      className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-red-600 px-4 py-2.5 text-center text-sm text-white shadow-md"
    >
      <p>
        <span className="font-semibold">A new update of the system is ready.</span> Save any work you're in the middle
        of, then update to get the latest changes.
      </p>
      <button
        type="button"
        onClick={updateNow}
        className="rounded-md bg-white px-3 py-1 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-red-600"
      >
        Update now
      </button>
    </div>
  );
}
