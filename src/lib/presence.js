// Presence derivation shared by the friends list and chat header.
// A user is "online" if their last heartbeat is within the threshold below.
const ONLINE_THRESHOLD_MS = 45000;

/**
 * Derive presence from a user_profiles record.
 *
 * @param {object} profile - a user_profiles doc (may have last_active Timestamp)
 * @param {number} now - current time in ms (callers tick this every ~20s)
 * @returns {{ isOnline: boolean, lastActiveText: string }}
 *          lastActiveText is '' when online or when last_active is unknown,
 *          so callers can apply their own fallback label.
 */
export function getPresence(profile, now = Date.now()) {
  const ms = profile?.last_active?.toMillis?.();
  if (!ms) return { isOnline: false, lastActiveText: '' };

  const diff = now - ms;
  if (diff < ONLINE_THRESHOLD_MS) return { isOnline: true, lastActiveText: '' };

  const mins = Math.floor(diff / 60000);
  let lastActiveText;
  if (mins < 60) lastActiveText = `Hoạt động ${mins || 1} phút trước`;
  else if (mins < 1440) lastActiveText = `Hoạt động ${Math.floor(mins / 60)} giờ trước`;
  else lastActiveText = `Hoạt động ${Math.floor(mins / 1440)} ngày trước`;

  return { isOnline: false, lastActiveText };
}
