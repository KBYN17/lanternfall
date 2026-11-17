// The game's rules and state, with no drawing and no browser in it: the
// lantern, the rising fireflies and ember-moths, the falling rain, the flame
// that is both fuel and health, the combo, the nights and the boons chosen
// between them. step() advances one fixed step and returns what happened as
// bit flags, so the caller can react (sound, particles, screens) without the
// world knowing about screens or sound. Nothing here allocates after
// createWorld returns.

import { BOONS, COMBO, FIELD, FIREFLY, FLAME, LANTERN, MOTH, NIGHT_SECONDS, RAIN } from './config.js';

export const KIND_FIREFLY = 0;
export const KIND_MOTH = 1;
export const KIND_RAIN = 2;

export const EVENT_CATCH = 1;
export const EVENT_MOTH = 2;
export const EVENT_HIT = 4;
export const EVENT_BLOCKED = 8;
export const EVENT_OVER = 16;
export const EVENT_NIGHT_END = 32;

const POOL_FLIES = 48;
const POOL_MOTHS = 6;
const POOL_RAIN = 48;

function distance(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function createWorld(random) {
  const lantern = { x: FIELD.width / 2, y: 480, vx: 0, vy: 0 };
  const flies = [];
  const moths = [];
  const drops = [];
  for (let i = 0; i < POOL_FLIES; i += 1) {
    flies.push({ active: false, x: 0, y: 0, rise: 0, phase: 0, wobble: 0, size: FIREFLY.size });
  }
  for (let i = 0; i < POOL_MOTHS; i += 1) {
    moths.push({ active: false, x: 0, y: 0, rise: 0, phase: 0, size: MOTH.size });
  }
  for (let i = 0; i < POOL_RAIN; i += 1) {
    drops.push({ active: false, x: 0, y: 0, fall: 0, drift: 0 });
  }

  const state = {
    lantern,
    flies,
    moths,
    drops,
    flame: FLAME.start,
    score: 0,
    combo: 0,
    bestCombo: 0,
    night: 1,
    nightTime: 0,
    elapsed: 0,
    flyTimer: 0.4,
    mothTimer: MOTH.interval,
    rainTimer: 0.8,
    boons: {},
    shieldLeft: 0,
    /** The last catch, for particles and popups: { x, y, points, moth }. */
    lastCatch: null,
    /** Three boon ids offered after the last night ended. */
    offered: [],
  };

  function boonLevel(id) {
    return state.boons[id] ?? 0;
  }

  function glowRadius() {
    return LANTERN.glowRadius + 14 * boonLevel('glow');
  }

  function drainRate() {
    const base = FLAME.drainPerSecond + FLAME.drainPerNight * (state.night - 1);
    return base * (1 - 0.18 * boonLevel('wick'));
  }

  function moveSpeed() {
    return LANTERN.speed * (1 + 0.15 * boonLevel('wings'));
  }

  function pointsMultiplier() {
    return (1 + 0.25 * boonLevel('gold')) * (1 + Math.min(state.combo, COMBO.max) * 0.25);
  }

  function magnetRadius() {
    const level = boonLevel('magnet');
    return level === 0 ? 0 : 120 + 40 * (level - 1);
  }

  function reset() {
    lantern.x = FIELD.width / 2;
    lantern.y = 480;
    for (const fly of flies) fly.active = false;
    for (const moth of moths) moth.active = false;
    for (const drop of drops) drop.active = false;
    state.flame = FLAME.start;
    state.score = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.night = 1;
    state.nightTime = 0;
    state.elapsed = 0;
    state.flyTimer = 0.4;
    state.mothTimer = MOTH.interval;
    state.rainTimer = 0.8;
    state.boons = {};
    state.shieldLeft = 0;
    state.lastCatch = null;
    state.offered = [];
  }

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function spawnFirefly() {
    const fly = free(flies);
    if (fly === null) return;
    fly.active = true;
    fly.x = 30 + random() * (FIELD.width - 60);
    fly.y = FIELD.height + 12;
    fly.rise = FIREFLY.riseMin + random() * (FIREFLY.riseMax - FIREFLY.riseMin);
    fly.phase = random() * Math.PI * 2;
    fly.wobble = FIREFLY.wobble * (0.6 + random() * 0.8);
  }

  function spawnMoth() {
    const moth = free(moths);
    if (moth === null) return;
    moth.active = true;
    moth.x = 60 + random() * (FIELD.width - 120);
    moth.y = FIELD.height + 16;
    moth.rise = MOTH.riseMin + random() * (MOTH.riseMax - MOTH.riseMin);
    moth.phase = random() * Math.PI * 2;
  }

  function spawnRain() {
    const drop = free(drops);
    if (drop === null) return;
    drop.active = true;
    // The storm hunts the light: some drops fall near the lantern, so standing
    // still beneath a firefly is a real risk and dodging is a real skill.
    if (random() < 0.35) {
      drop.x = Math.min(FIELD.width - 10, Math.max(10, lantern.x + (random() - 0.5) * 320));
    } else {
      drop.x = random() * FIELD.width;
    }
    drop.y = -RAIN.length;
    drop.fall = RAIN.fallMin + random() * (RAIN.fallMax - RAIN.fallMin) + RAIN.fallPerNight * (state.night - 1);
    drop.drift = (random() - 0.5) * 2 * RAIN.drift;
  }

  function flyInterval() {
    return Math.max(FIREFLY.minInterval, FIREFLY.interval * FIREFLY.intervalScale ** (state.night - 1));
  }

  function rainInterval() {
    return Math.max(RAIN.minInterval, RAIN.interval * RAIN.intervalScale ** (state.night - 1));
  }

  /** Three boons the keeper may choose from; never one already at max level. */
  function offerBoons() {
    const available = BOONS.filter((boon) => boonLevel(boon.id) < boon.maxLevel);
    const offered = [];
    while (offered.length < 3 && available.length > 0) {
      const index = Math.floor(random() * available.length);
      offered.push(available.splice(index, 1)[0].id);
    }
    state.offered = offered;
    return offered;
  }

  function applyBoon(id) {
    const boon = BOONS.find((entry) => entry.id === id);
    if (!boon) return false;
    if (boonLevel(id) >= boon.maxLevel) return false;
    state.boons[id] = boonLevel(id) + 1;
    if (id === 'cloak') state.shieldLeft += 1;
    return true;
  }

  function startNextNight() {
    state.night += 1;
    state.nightTime = 0;
    state.shieldLeft = boonLevel('cloak');
    state.flyTimer = 0.3;
    state.rainTimer = 0.6;
    state.offered = [];
  }

  function catchFly(fly, moth) {
    const points = Math.round((moth ? MOTH.points : FIREFLY.points) * pointsMultiplier());
    state.score += points;
    state.combo += 1;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    state.flame = Math.min(FLAME.max, state.flame + (moth ? FLAME.perMoth : FLAME.perFirefly));
    state.lastCatch = { x: fly.x, y: fly.y, points, moth };
    fly.active = false;
    return points;
  }

  /**
   * One fixed step. `steer` is { x, y } in -1..1 (keys, or the pointer's pull).
   * With `harmless` set (the title screen's backdrop) things drift but nothing
   * is caught, nothing hurts the lantern and the flame never burns down.
   */
  function step(dt, steer, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (!harmless) state.nightTime += dt;

    const speed = moveSpeed();
    lantern.x = Math.min(FIELD.width - LANTERN.bodyRadius, Math.max(LANTERN.bodyRadius, lantern.x + steer.x * speed * dt));
    lantern.y = Math.min(LANTERN.maxY, Math.max(LANTERN.minY, lantern.y + steer.y * speed * dt));

    if (!harmless) {
      state.flame -= drainRate() * dt;
      if (state.flame <= 0) {
        state.flame = 0;
        return EVENT_OVER;
      }
    }

    state.flyTimer -= dt;
    if (state.flyTimer <= 0) {
      spawnFirefly();
      state.flyTimer += flyInterval() * (0.8 + random() * 0.4);
    }
    state.mothTimer -= dt;
    if (state.mothTimer <= 0) {
      spawnMoth();
      state.mothTimer += MOTH.interval + random() * MOTH.intervalJitter;
    }
    state.rainTimer -= dt;
    if (state.rainTimer <= 0) {
      spawnRain();
      state.rainTimer += rainInterval() * (0.8 + random() * 0.4);
    }

    const glow = glowRadius();
    const magnet = magnetRadius();

    for (const fly of flies) {
      if (!fly.active) continue;
      fly.phase += dt * 2.2;
      fly.y -= fly.rise * dt;
      fly.x += Math.sin(fly.phase) * fly.wobble * dt;
      if (magnet > 0 && !harmless) {
        const d = distance(fly.x, fly.y, lantern.x, lantern.y);
        if (d < magnet && d > 1) {
          fly.x += ((lantern.x - fly.x) / d) * 150 * dt;
          fly.y += ((lantern.y - fly.y) / d) * 150 * dt;
        }
      }
      if (fly.y < -20) {
        fly.active = false;
        if (!harmless && COMBO.escapeResets) state.combo = 0;
        continue;
      }
      if (harmless) continue;
      if (distance(fly.x, fly.y, lantern.x, lantern.y) < glow + fly.size) {
        catchFly(fly, false);
        events |= EVENT_CATCH;
      }
    }

    for (const moth of moths) {
      if (!moth.active) continue;
      moth.phase += dt * 3.1;
      moth.y -= moth.rise * dt;
      moth.x += Math.sin(moth.phase) * 90 * dt;
      if (moth.y < -24) {
        moth.active = false;
        if (!harmless) state.combo = 0;
        continue;
      }
      if (harmless) continue;
      if (distance(moth.x, moth.y, lantern.x, lantern.y) < glow + moth.size) {
        catchFly(moth, true);
        events |= EVENT_MOTH;
      }
    }

    for (const drop of drops) {
      if (!drop.active) continue;
      drop.y += drop.fall * dt;
      drop.x += drop.drift * dt;
      if (drop.y > FIELD.groundY) {
        drop.active = false;
        continue;
      }
      if (harmless) continue;
      if (distance(drop.x, drop.y, lantern.x, lantern.y) < LANTERN.bodyRadius) {
        drop.active = false;
        if (state.shieldLeft > 0) {
          state.shieldLeft -= 1;
          events |= EVENT_BLOCKED;
        } else {
          state.flame -= FLAME.perRainHit;
          state.combo = 0;
          events |= EVENT_HIT;
          if (state.flame <= 0) {
            state.flame = 0;
            events |= EVENT_OVER;
            break;
          }
        }
      }
    }

    if (!harmless && state.nightTime + 1e-6 >= NIGHT_SECONDS) events |= EVENT_NIGHT_END;
    return events;
  }

  reset();
  return {
    state,
    reset,
    step,
    offerBoons,
    applyBoon,
    startNextNight,
    boonLevel,
    glowRadius,
    drainRate,
    pointsMultiplier,
  };
}
