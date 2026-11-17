// Lanternfall — every tuning number and colour lives in this one file.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720, groundY: 648 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** One night lasts this long; surviving it opens the boon choice. */
export const NIGHT_SECONDS = 45;

export const LANTERN = {
  /** Radius of the lantern's glass body (what rain can strike). */
  bodyRadius: 24,
  /** Radius of the glow that catches fireflies. */
  glowRadius: 54,
  speed: 520,
  /** Vertical band the lantern may fly in. */
  minY: 96,
  maxY: 620,
};

export const FLAME = {
  max: 100,
  start: 70,
  /** Flame lost per second, before the night's extra burn and Thick Wick. */
  drainPerSecond: 1.15,
  drainPerNight: 0.12,
  /** Flame a caught firefly feeds back. */
  perFirefly: 1.0,
  /** Flame a caught ember-moth feeds back. */
  perMoth: 6,
  /** Flame a raindrop steals on a hit. */
  perRainHit: 12,
};

export const FIREFLY = {
  size: 7,
  /** Rise speed, upward, in px/s. */
  riseMin: 42,
  riseMax: 78,
  wobble: 26,
  /** Seconds between spawns at night 1; multiplied by intervalScale each night. */
  interval: 0.85,
  intervalScale: 0.94,
  minInterval: 0.3,
  points: 10,
};

export const MOTH = {
  size: 11,
  riseMin: 55,
  riseMax: 70,
  /** Seconds between ember-moths. */
  interval: 13,
  intervalJitter: 5,
  points: 25,
};

export const RAIN = {
  width: 3,
  length: 26,
  fallMin: 380,
  fallMax: 470,
  /** Extra fall speed per night. */
  fallPerNight: 26,
  /** Seconds between drops at night 1; multiplied by intervalScale each night. */
  interval: 0.8,
  intervalScale: 0.82,
  minInterval: 0.28,
  /** Horizontal drift of a drop, px/s. */
  drift: 46,
};

export const COMBO = {
  /** Combo multiplier caps here (x5). */
  max: 5,
  /** A firefly that escapes off the top, or a rain hit, resets the combo. */
  escapeResets: true,
};

/** Boons offered between nights. Each may be taken up to MAX_LEVEL times. */
export const BOONS = [
  { id: 'glow', name: 'Wide Glow', desc: 'Glow reaches +14 px further.', maxLevel: 3 },
  { id: 'wick', name: 'Thick Wick', desc: 'Flame burns 18% slower.', maxLevel: 3 },
  { id: 'cloak', name: 'Raincloak', desc: 'Block a raindrop each night.', maxLevel: 3 },
  { id: 'magnet', name: 'Firefly Magnet', desc: 'Fireflies drift toward you.', maxLevel: 3 },
  { id: 'gold', name: 'Golden Touch', desc: 'Catches are worth +25% more.', maxLevel: 3 },
  { id: 'wings', name: 'Swift Wings', desc: 'You fly 15% faster.', maxLevel: 3 },
];

export const PALETTE = {
  backdrop: '#070a18',
  skyTop: '#0b1026',
  skyMid: '#1a2340',
  skyLow: '#33254d',
  ground: '#0e1a24',
  grass: '#16281f',
  pine: '#0a1410',
  moon: '#f5ead0',
  star: '#dfe8ff',
  lanternGlass: '#ffd98a',
  lanternBrass: '#c98f2e',
  flameCore: '#fff3c4',
  flameOuter: '#ff9a3c',
  firefly: '#c8f169',
  fireflyCore: '#f4ffd6',
  moth: '#ffb347',
  rain: '#7fa8d9',
  text: '#f2ead8',
  muted: '#a8b0c8',
  panel: '#141a2e',
  panelEdge: '#3a4668',
  flameBar: '#ff9a3c',
  flameBarLow: '#e5534b',
  card: '#1c2440',
  cardHover: '#28325a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lanternfall.best';
