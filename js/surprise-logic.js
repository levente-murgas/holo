// Pure helpers for Surprise mode (tested in Node).

// Is the phone lying face down? deviceorientation's beta is the front-to-back tilt in degrees:
// about 0 lying face up, about ±180 lying face down. Hysteresis (enter past 150°, leave below 120°)
// stops the state flickering while the phone settles into the stand.
export function isFaceDown(beta, wasDown = false) {
  if (beta == null || Number.isNaN(beta)) return false;
  const tilt = Math.abs(beta);
  return wasDown ? tilt > 120 : tilt > 150;
}

// Surprise mode applies to messages someone else sent you, and to your own ones too if includeOwn.
export const isSurprise = (enabled, msg, myId, includeOwn = false) =>
  !!(enabled && msg && (includeOwn || msg.sender !== myId));
