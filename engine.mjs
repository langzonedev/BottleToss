export const FLIGHT = 0.39;
export const AIM_DEPTH = 16;
export const WINDUP = 0.18;
export const AMMO = 18;
export const DURATION = 60;
const BOOST_SECONDS = 4.5;
const BOOST_KMH = 12;
export const HOME = { x: 5.75, y: 2.30 };

export const signs = {
  direction: { name: 'DIRECTION', points: 100, w: 2.75, h: 1.12, y: 2.32, window: 5.2 },
  warning: { name: 'WARNING', points: 200, w: 1.16, h: 1.16, y: 2.31, window: 3.9 },
  speed: { name: 'SPEED LIMIT', points: 350, w: .79, h: .79, y: 2.42, window: 2.8 },
  radar: { name: 'RADAR BONUS', points: 750, w: 1.10, h: .70, y: 1.85, window: 2.55 },
};

const pattern = [
  ['direction', 5.75, 0], ['warning', 5.72, 0], ['speed', 5.72, .10],
  ['direction', 6.55, -.13], ['speed', 5.20, -.48], ['warning', 6.48, .34],
  ['speed', 6.28, .48], ['direction', 5.75, -.25], ['warning', 5.18, -.33],
  ['speed', 5.95, .15], ['warning', 6.18, .30], ['direction', 6.7, .12],
];

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const pace = (time) => 90 + 8 * Math.sin(time * .21) + 2 * Math.sin(time * .63);

// Integrate the same speed curve for the road, the sight and bottle arrival.
export function distance(time) {
  return (90 * time + 8 * (1 - Math.cos(time * .21)) / .21
    + 2 * (1 - Math.cos(time * .63)) / .63) / 3.6;
}

export function boostSpeed(time, boost) {
  if (!boost) return 0;
  const phase = clamp((time - boost.at) / BOOST_SECONDS, 0, 1);
  return phase === 1 ? 0 : BOOST_KMH * Math.sin(Math.PI * phase);
}

export function boostDistance(time, boost) {
  if (!boost) return 0;
  const phase = clamp((time - boost.at) / BOOST_SECONDS, 0, 1);
  return boost.carried + (BOOST_KMH / 3.6) * (BOOST_SECONDS / Math.PI) * (1 - Math.cos(Math.PI * phase));
}

export function routeLight(time, mode = 'minute') {
  const endless = mode === 'endurance';
  const t = endless ? time % 240 : time;
  const dayEnd = endless ? 100 : 22;
  const sunsetEnd = endless ? 130 : 38;
  const nightStart = endless ? 165 : 52;
  const fade = (start, end) => {
    const progress = clamp((t - start) / (end - start), 0, 1);
    return progress * progress * (3 - 2 * progress);
  };
  if (endless && t >= 210) {
    const sunrise = fade(210,240);
    return { daylight: sunrise, dark: 1 - sunrise, sun: mix(1,.10,sunrise) };
  }
  const sunset = fade(dayEnd,sunsetEnd);
  const dark = fade(sunsetEnd,nightStart);
  const sun = t < dayEnd ? mix(.10,.32,fade(0,dayEnd))
    : t < sunsetEnd ? mix(.32,.59,sunset) : mix(.59,1,dark);
  return { daylight: 1 - sunset, dark, sun };
}

export function makeTarget(index, z, radar = false) {
  const [kind, x, rise] = radar && [5, 12, 17].includes(index % 19)
    ? ['radar', index % 2 ? 6.32 : 6.68, 0]
    : pattern[index % pattern.length];
  return { kind, x, y: signs[kind].y + rise, z, label: [80, 90, 100][index % 3], hitAt: null };
}

export function targetContact(target, depth, aim, practice) {
  const { w, h, window } = signs[target.kind];
  const grace = practice ? 1.35 : 1;
  const t = (depth - AIM_DEPTH) / (window * grace);
  const x = (aim.x - target.x) / ((w / 2 + .16) * grace);
  const y = (aim.y - target.y) / ((h / 2 + .12) * grace);
  const shape = target.kind === 'speed' ? Math.hypot(x, y)
    : target.kind === 'warning' ? Math.abs(x) + Math.abs(y) : Math.max(Math.abs(x), Math.abs(y));
  return { t, shape, hit: Math.abs(t) <= 1 && shape <= 1, perfect: Math.abs(t) < .34 && shape < .51 };
}

export function scoreHit(kind, streak, perfect) {
  const multiplier = Math.min(4, 1 + Math.floor((streak - 1) / 2));
  return { multiplier, points: (signs[kind].points + (perfect ? 50 : 0)) * multiplier };
}
