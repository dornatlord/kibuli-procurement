import { useEffect, useState } from "react";
import { api, OfflineError } from "./api";
import { useAuth } from "./auth";
import { useOnline } from "./online";
import { copyOwner, lastFullSave, markFullSave } from "./savedCopies";
import { dismissSent, onOutboxChange, queuedRequests, sendQueued, sentRequests } from "./outbox";

/** How long the copies saved for offline use are trusted before they're saved again. */
const REFRESH_AFTER = 3 * 60 * 60 * 1000;

type Can = (...permissions: string[]) => boolean;

/**
 * Load, and so keep a copy on this computer of, what staff need away from
 * school: their requests with details, and everything the New Request form
 * looks up. Other pages keep a copy once they've been opened.
 * Returns false if the connection dropped part-way.
 */
export async function saveForOffline(can: Can): Promise<boolean> {
  const owner = copyOwner();
  const loaded = new Map<string, unknown>();
  let dropped = false;

  async function loadAll(paths: string[]) {
    const waiting = [...paths];
    const worker = async () => {
      for (let path = waiting.shift(); path && !dropped; path = waiting.shift()) {
        try {
          loaded.set(path, await api.get(path, { savedCopy: false }));
        } catch (err) {
          // Anything else (no permission, a removed record) just isn't saved.
          if (err instanceof OfflineError) dropped = true;
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }
  const ids = (path: string) => ((loaded.get(path) as { id: number }[] | undefined) ?? []).map((r) => r.id);

  await loadAll([
    ...(can("requests.view.own", "requests.view.department", "requests.view.all") ? ["/requests"] : []),
    ...(can("requests.create") ? ["/lookup/votes"] : []),
    ...(can("reserve_prices.view") ? ["/reserve-prices"] : []),
    ...(can("requests.create", "reserve_prices.manage") ? ["/baskets"] : []),
    ...(can("purchase_orders.view") ? ["/purchase-orders"] : []),
    "/settings/terms",
  ]);
  const voteIds = ids("/lookup/votes");
  await loadAll([
    ...ids("/requests").slice(0, 40).map((id) => `/requests/${id}`),
    ...voteIds.map((id) => `/lookup/votes/${id}/sub-programmes`),
    ...ids("/baskets").map((id) => `/baskets/${id}`),
  ]);
  // A vote's budget lines hang off its sub-programmes, or off the vote itself
  // when it has none.
  await loadAll(
    voteIds.flatMap((id) => {
      const path = `/lookup/votes/${id}/sub-programmes`;
      if (!loaded.has(path)) return [];
      const subs = ids(path);
      return subs.length ? subs.map((s) => `/lookup/sub-programmes/${s}/items`) : [`/lookup/votes/${id}/items`];
    })
  );

  if (dropped) return false;
  await markFullSave(owner);
  return true;
}

/**
 * While the server can be reached: send requests filled in offline, then keep
 * the offline copies fresh. Returns what the notices in the layout show.
 */
export function useOfflineWork() {
  const { user, can } = useAuth();
  const online = useOnline();
  const userId = user?.id ?? null;
  const [queued, setQueued] = useState(() => (userId ? queuedRequests(userId) : []));
  const [sent, setSent] = useState(sentRequests);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    const update = () => {
      setQueued(queuedRequests(userId));
      setSent(sentRequests());
    };
    update();
    return onOutboxChange(update);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const last = await lastFullSave();
      if (active) setSavedAt(last);
      if (!online) return;

      const sentBefore = sentRequests().length;
      await sendQueued(userId);
      const listsChanged = sentRequests().length > sentBefore;

      if (listsChanged || !last || Date.now() - last > REFRESH_AFTER) {
        if ((await saveForOffline(can)) && active) setSavedAt(await lastFullSave());
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, online]);

  return { online, queued, sent, dismissSent, savedAt };
}
