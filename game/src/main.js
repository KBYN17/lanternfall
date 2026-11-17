// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, boon choice, paused and game over.
//
// ?seed=N fixes the night's pattern. ?shot=start|play|boon|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BLOCKED, EVENT_CATCH, EVENT_HIT, EVENT_MOTH, EVENT_NIGHT_END, EVENT_OVER } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_BOON, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createParticles } from './particles.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, never replayed. */
const MAX_FRAME = 0.25;
/** Pixels of screen shake after a raindrop hit, fading each frame. */
const SHAKE_ON_HIT = 9;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const particles = createParticles();
const renderer = createRenderer(canvas, particles);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: scene.best, muted: false, shake: 0, glowRadius: world.glowRadius() });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let shake = 0;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    particles.step(10);
    accumulator = 0;
    shake = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Feed the flame, dodge the rain.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.gameOver();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`The flame has died. Score ${world.state.score}. Best ${best}.`);
  }

  function openBoons() {
    input.takeBoonPick();
    input.takeClick();
    const offered = world.offerBoons();
    if (offered.length === 0) {
      world.startNextNight();
      announce(`Night ${world.state.night}.`);
      return;
    }
    screen = SCREEN_BOON;
    audio.nightEnd();
    announce(`Night ${world.state.night} survived. Choose a boon.`);
  }

  function chooseBoon(id) {
    if (world.applyBoon(id)) {
      audio.boon();
      world.startNextNight();
      screen = SCREEN_PLAY;
      announce(`Night ${world.state.night}.`);
    }
  }

  /** Steer from keys, or ease toward the pointer when it moved last. */
  function steer() {
    const keys = input.keySteer();
    if (keys.x !== 0 || keys.y !== 0) return keys;
    const pointer = input.pointerPosition();
    if (pointer === null) return { x: 0, y: 0 };
    const target = renderer.toLogical(pointer.x, pointer.y);
    const lantern = world.state.lantern;
    return {
      x: Math.max(-1, Math.min(1, (target.x - lantern.x) / 48)),
      y: Math.max(-1, Math.min(1, (target.y - lantern.y) / 48)),
    };
  }

  function handleEvents(events) {
    const state = world.state;
    if (events & EVENT_CATCH) {
      const caught = state.lastCatch;
      if (caught) {
        particles.burst(caught.x, caught.y, '#c8f169', 10);
        particles.popup(caught.x, caught.y - 14, `+${caught.points}`);
        audio.catch(state.combo);
      }
    }
    if (events & EVENT_MOTH) {
      const caught = state.lastCatch;
      if (caught) {
        particles.burst(caught.x, caught.y, '#ffb347', 18, 220);
        particles.popup(caught.x, caught.y - 14, `+${caught.points}`);
        audio.moth();
      }
    }
    if (events & EVENT_HIT) {
      shake = SHAKE_ON_HIT;
      particles.burst(state.lantern.x, state.lantern.y, '#7fa8d9', 14, 200);
      audio.rainHit();
      announce(`Rain hit. Flame ${Math.round(state.flame)}.`);
    }
    if (events & EVENT_BLOCKED) {
      audio.blocked();
      particles.burst(state.lantern.x, state.lantern.y, '#9fc3ff', 8, 120);
      announce('Raincloak blocked a drop.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_BOON) {
      const pick = input.takeBoonPick();
      if (pick >= 0 && pick < world.state.offered.length) chooseBoon(world.state.offered[pick]);
      const click = input.takeClick();
      if (click) {
        const id = renderer.boonCardAt(renderer.toLogical(click.x, click.y));
        if (id) chooseBoon(id);
      }
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      audio.unlock();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, true);
      return;
    }
    const events = world.step(STEP, steer(), false);
    handleEvents(events);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_NIGHT_END) openBoons();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    particles.step(STEP);
    if (shake > 0) shake = Math.max(0, shake - 0.6);
    renderer.draw(world.state, screen, { best, muted, shake, glowRadius: world.glowRadius() });
  }

  // Leaving the tab pauses a running game rather than letting the flame burn unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lanternfall. Press Space or click to light the lantern.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
