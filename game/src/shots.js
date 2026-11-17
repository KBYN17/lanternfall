// The screenshot scenes behind ?shot=start|play|boon|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (chase the highest firefly, step aside from rain
// falling straight at the lantern), so the frame is what a real game looks
// like and the same seed always gives the same frame.

import { FIELD, LANTERN, NIGHT_SECONDS, STEP } from './config.js';
import { EVENT_NIGHT_END, EVENT_OVER } from './world.js';
import { SCREEN_BOON, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;

/** How far ahead, in seconds, the autopilot looks for rain above the lantern. */
const HORIZON_PLAY = 0.8;
const HORIZON_END = 0;

function nearestFly(state) {
  let best = null;
  for (const fly of state.flies) {
    if (fly.active && (best === null || fly.y < best.y)) best = fly;
  }
  for (const moth of state.moths) {
    if (moth.active && (best === null || moth.y < best.y)) best = moth;
  }
  return best;
}

/** Steer toward `target` while stepping out from under drops overhead. */
function autopilot(state, horizon) {
  const lantern = state.lantern;
  let dx = 0;
  let dy = 0;
  for (const drop of state.drops) {
    if (!drop.active) continue;
    const above = lantern.y - drop.y;
    if (above > 0 && above < 260 && Math.abs(drop.x - lantern.x) < LANTERN.bodyRadius + 26) {
      dx = drop.x >= lantern.x ? -1 : 1;
      break;
    }
  }
  if (dx === 0) {
    const target = nearestFly(state);
    if (target) {
      if (target.x > lantern.x + 10) dx = 1;
      else if (target.x < lantern.x - 10) dx = -1;
      if (target.y > lantern.y + 10) dy = 1;
      else if (target.y < lantern.y - 10) dy = -1;
    } else {
      dx = lantern.x < FIELD.width / 2 ? 1 : -1;
    }
  }
  // With horizon 0 the pilot never dodges: it walks straight into the rain,
  // as a hurried player does, so the end scene is reached.
  if (horizon === 0) {
    const target = nearestFly(state);
    if (target) {
      dx = target.x > lantern.x + 10 ? 1 : target.x < lantern.x - 10 ? -1 : 0;
      dy = target.y > lantern.y + 10 ? 1 : target.y < lantern.y - 10 ? -1 : 0;
    }
  }
  return { x: dx, y: dy };
}

/**
 * Set `world` to the named scene (start, play, boon or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'boon' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { x: 0, y: 0 }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'boon') {
    for (let index = 0; index < NIGHT_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world.state, HORIZON_PLAY), false);
      if (events & EVENT_NIGHT_END) break;
      if (events & EVENT_OVER) break;
    }
    world.offerBoons();
    return { screen: SCREEN_BOON, best: world.state.score };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const horizon = name === 'end' ? HORIZON_END : HORIZON_PLAY;
  for (let index = 0; index < limit / STEP; index += 1) {
    if (world.step(STEP, autopilot(world.state, horizon), false) & EVENT_OVER) break;
  }
  const over = world.state.flame === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
