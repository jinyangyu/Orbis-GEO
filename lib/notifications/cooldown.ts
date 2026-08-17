const WINDOW_MS = 5 * 60 * 1000;
const lastCheck = new Map<string, number>();

export function shouldSkipNotificationCheck(
  workspaceId: string,
  nowMs = Date.now(),
): boolean {
  const prev = lastCheck.get(workspaceId);
  return prev != null && nowMs - prev < WINDOW_MS;
}

export function markNotificationCheck(
  workspaceId: string,
  nowMs = Date.now(),
) {
  lastCheck.set(workspaceId, nowMs);
}

/** Unit tests only. */
export function resetNotificationCheckCooldown() {
  lastCheck.clear();
}
