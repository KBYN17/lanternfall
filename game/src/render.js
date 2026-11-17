// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. The night is painted in layers — gradient
// sky, twinkling stars, moon, pine silhouettes, grass — then the glowing
// things (fireflies, moths, the lantern) from one pre-rendered glow sprite,
// then rain, particles and the HUD or a panel. Text that holds a number is
// rebuilt only when the number changes, so a frame allocates nothing.

import { BOONS, FIELD, FONT, LANTERN, NIGHT_SECONDS, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_BOON = 'boon';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
const CARD = { width: 320, height: 210, gap: 28, top: 268 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

/** A soft radial glow, painted once and stamped wherever light is needed. */
function makeGlowSprite(color) {
  const size = 128;
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const ctx = sprite.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.35, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return sprite;
}

function mulberry(seed) {
  let state = seed >>> 0;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRenderer(canvas, particles) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, width: 0, height: 0 };
  const scoreLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const nightLabel = cachedLabel('Night ');
  const finalLabel = cachedLabel('Score ');
  const comboLabel = cachedLabel('Combo ');

  const fireflyGlow = makeGlowSprite('rgba(200,241,105,0.55)');
  const mothGlow = makeGlowSprite('rgba(255,179,71,0.6)');
  const lanternGlow = makeGlowSprite('rgba(255,180,80,0.5)');
  const moonGlow = makeGlowSprite('rgba(245,234,208,0.35)');

  // The night sky never changes: stars and pines are placed once, seeded,
// so every visit to the garden looks like the same garden.
  const starRandom = mulberry(20261117);
  const stars = [];
  for (let i = 0; i < 110; i += 1) {
    stars.push({
      x: starRandom() * FIELD.width,
      y: starRandom() * 430,
      size: 0.8 + starRandom() * 1.8,
      phase: starRandom() * Math.PI * 2,
      speed: 0.6 + starRandom() * 1.4,
    });
  }
  const pines = [];
  for (let x = -20; x < FIELD.width + 40; x += 46) {
    pines.push({ x: x + starRandom() * 20, height: 52 + starRandom() * 66, width: 34 + starRandom() * 22 });
  }

  let boonRects = [];
  let time = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.width = width;
    view.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * (canvas.width / rect.width) - view.x) / view.scale,
      y: ((clientY - rect.top) * (canvas.height / rect.height) - view.y) / view.scale,
    };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function stamp(sprite, x, y, radius, alpha) {
    context.globalAlpha = alpha;
    context.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    context.globalAlpha = 1;
  }

  function drawSky(now) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.55, PALETTE.skyMid);
    gradient.addColorStop(1, PALETTE.skyLow);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    for (const star of stars) {
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(now * 0.001 * star.speed + star.phase));
      context.globalAlpha = twinkle * 0.9;
      context.fillStyle = PALETTE.star;
      context.fillRect(star.x, star.y, star.size, star.size);
    }
    context.globalAlpha = 1;

    stamp(moonGlow, 1120, 108, 150, 0.9);
    context.fillStyle = PALETTE.moon;
    context.beginPath();
    context.arc(1120, 108, 44, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(190,175,140,0.5)';
    context.beginPath();
    context.arc(1106, 96, 9, 0, Math.PI * 2);
    context.arc(1132, 120, 6, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = PALETTE.pine;
    for (const pine of pines) {
      const base = FIELD.groundY + 72;
      context.beginPath();
      context.moveTo(pine.x - pine.width / 2, base);
      context.lineTo(pine.x, base - pine.height);
      context.lineTo(pine.x + pine.width / 2, base);
      context.closePath();
      context.fill();
    }
    context.fillStyle = PALETTE.ground;
    context.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, FIELD.groundY, FIELD.width, 6);
  }

  function drawLantern(state, glowRadius, now) {
    const lantern = state.lantern;
    const flicker = 0.86 + 0.14 * Math.sin(now * 0.011) * Math.sin(now * 0.0047 + 1.3);
    stamp(lanternGlow, lantern.x, lantern.y, glowRadius * 2.1 * flicker, 0.85);
    context.strokeStyle = PALETTE.lanternBrass;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(lantern.x, lantern.y - LANTERN.bodyRadius - 6, 12, Math.PI, 0);
    context.stroke();
    // Glass body.
    const bodyGradient = context.createLinearGradient(lantern.x, lantern.y - 26, lantern.x, lantern.y + 26);
    bodyGradient.addColorStop(0, '#ffe9ad');
    bodyGradient.addColorStop(0.5, PALETTE.lanternGlass);
    bodyGradient.addColorStop(1, '#e8a83c');
    context.fillStyle = bodyGradient;
    context.beginPath();
    context.ellipse(lantern.x, lantern.y, 22, 26, 0, 0, Math.PI * 2);
    context.fill();
    // Flame inside the glass.
    const flameH = 20 * flicker;
    context.fillStyle = PALETTE.flameOuter;
    context.beginPath();
    context.moveTo(lantern.x, lantern.y - flameH);
    context.quadraticCurveTo(lantern.x + 9, lantern.y - 2, lantern.x, lantern.y + 8);
    context.quadraticCurveTo(lantern.x - 9, lantern.y - 2, lantern.x, lantern.y - flameH);
    context.fill();
    context.fillStyle = PALETTE.flameCore;
    context.beginPath();
    context.ellipse(lantern.x, lantern.y + 1, 4, 7 * flicker, 0, 0, Math.PI * 2);
    context.fill();
    // Brass caps and ribs.
    context.fillStyle = PALETTE.lanternBrass;
    context.fillRect(lantern.x - 16, lantern.y - 30, 32, 6);
    context.fillRect(lantern.x - 16, lantern.y + 24, 32, 6);
    context.strokeStyle = 'rgba(120,70,10,0.55)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(lantern.x - 20, lantern.y - 12);
    context.lineTo(lantern.x - 20, lantern.y + 12);
    context.moveTo(lantern.x + 20, lantern.y - 12);
    context.lineTo(lantern.x + 20, lantern.y + 12);
    context.stroke();
    // The glow's catching edge, faintly, so the player can feel its reach.
    context.strokeStyle = 'rgba(255,214,130,0.22)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(lantern.x, lantern.y, glowRadius, 0, Math.PI * 2);
    context.stroke();
  }

  function drawField(state, glowRadius, now) {
    drawSky(now);

    for (const fly of state.flies) {
      if (!fly.active) continue;
      const pulse = 0.7 + 0.3 * Math.sin(now * 0.006 + fly.phase);
      stamp(fireflyGlow, fly.x, fly.y, 26 * pulse, 0.9);
      context.fillStyle = PALETTE.fireflyCore;
      context.beginPath();
      context.arc(fly.x, fly.y, fly.size * 0.55, 0, Math.PI * 2);
      context.fill();
    }
    for (const moth of state.moths) {
      if (!moth.active) continue;
      const pulse = 0.75 + 0.25 * Math.sin(now * 0.009 + moth.phase);
      stamp(mothGlow, moth.x, moth.y, 34 * pulse, 0.95);
      context.fillStyle = '#ffe6b0';
      context.beginPath();
      context.ellipse(moth.x - 7, moth.y, 7, 4, -0.5, 0, Math.PI * 2);
      context.ellipse(moth.x + 7, moth.y, 7, 4, 0.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.moth;
      context.beginPath();
      context.ellipse(moth.x, moth.y, 4, 8, 0, 0, Math.PI * 2);
      context.fill();
    }

    for (const drop of state.drops) {
      if (!drop.active) continue;
      context.strokeStyle = 'rgba(127,168,217,0.75)';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(drop.x, drop.y);
      context.lineTo(drop.x - drop.drift * 0.05, drop.y + 26);
      context.stroke();
    }

    drawLantern(state, glowRadius, now);

    for (const spark of particles.sparks) {
      if (!spark.alive) continue;
      context.globalAlpha = Math.max(0, spark.life / spark.maxLife);
      context.fillStyle = spark.color;
      context.beginPath();
      context.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const popup of particles.popups) {
      if (!popup.alive) continue;
      context.globalAlpha = Math.max(0, popup.life / popup.maxLife);
      text(popup.text, popup.x, popup.y, 24, '#ffe9ad', 'center');
    }
    context.globalAlpha = 1;
  }

  function drawFlameBar(state) {
    const x = FIELD.width - 300;
    const y = 22;
    const width = 260;
    const height = 18;
    text('Flame', x - 12, y + 14, 24, PALETTE.text, 'right');
    context.fillStyle = 'rgba(0,0,0,0.45)';
    context.fillRect(x, y, width, height);
    const ratio = Math.max(0, state.flame / 100);
    context.fillStyle = ratio < 0.25 ? PALETTE.flameBarLow : PALETTE.flameBar;
    context.fillRect(x, y, width * ratio, height);
    context.strokeStyle = 'rgba(255,255,255,0.25)';
    context.lineWidth = 1;
    context.strokeRect(x, y, width, height);
    if (state.shieldLeft > 0) {
      text(`Shield x${state.shieldLeft}`, x + width, y + 44, 20, '#9fc3ff', 'right');
    }
  }

  function drawHud(state, best, muted) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 30, PALETTE.text, 'left');
    text(bestLabel(best), 24, 54, 20, PALETTE.muted, 'left');
    text(nightLabel(state.night), FIELD.width / 2, 18, 28, PALETTE.text, 'center');
    const barWidth = 220;
    const barX = FIELD.width / 2 - barWidth / 2;
    context.fillStyle = 'rgba(0,0,0,0.45)';
    context.fillRect(barX, 52, barWidth, 8);
    context.fillStyle = '#8fb7ff';
    context.fillRect(barX, 52, barWidth * Math.min(1, state.nightTime / NIGHT_SECONDS), 8);
    drawFlameBar(state);
    if (state.combo >= 2) {
      const comboX = 24;
      const comboY = 92;
      context.fillStyle = 'rgba(255,180,80,0.9)';
      context.beginPath();
      context.arc(comboX + 12, comboY + 9, 13, 0, Math.PI * 2);
      context.fill();
      text(comboLabel(state.combo), comboX + 34, comboY, 26, '#ffd98a', 'left');
    }
    text(muted ? 'M: sound off' : 'M: sound on', FIELD.width - 40, FIELD.height - 34, 18, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(7,10,24,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 48, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 24, '#ffd98a', 'center');
  }

  function drawBoonCards(state) {
    const totalWidth = CARD.width * 3 + CARD.gap * 2;
    const startX = (FIELD.width - totalWidth) / 2;
    boonRects = state.offered.map((id, index) => {
      const boon = BOONS.find((entry) => entry.id === id);
      const x = startX + index * (CARD.width + CARD.gap);
      const y = CARD.top;
      const level = (state.boons[id] ?? 0) + 1;
      context.fillStyle = PALETTE.card;
      context.fillRect(x, y, CARD.width, CARD.height);
      context.strokeStyle = PALETTE.panelEdge;
      context.lineWidth = 2;
      context.strokeRect(x, y, CARD.width, CARD.height);
      context.fillStyle = '#ffd98a';
      context.beginPath();
      context.arc(x + CARD.width / 2, y + 44, 20, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#1c2440';
      text(String(index + 1), x + CARD.width / 2, y + 52, 24, '#1c2440', 'center');
      text(boon.name, x + CARD.width / 2, y + 100, 26, PALETTE.text, 'center');
      const words = boon.desc.split(' ');
      let line = '';
      let lineY = y + 132;
      for (const word of words) {
        if ((line + word).length > 26 && line !== '') {
          text(line.trim(), x + CARD.width / 2, lineY, 19, PALETTE.muted, 'center');
          line = '';
          lineY += 24;
        }
        line += `${word} `;
      }
      if (line.trim() !== '') text(line.trim(), x + CARD.width / 2, lineY, 19, PALETTE.muted, 'center');
      text(`Level ${level} of ${boon.maxLevel}`, x + CARD.width / 2, y + CARD.height - 18, 18, '#8fb7ff', 'center');
      return { x, y, width: CARD.width, height: CARD.height, id };
    });
  }

  const TITLE_LINES = [
    'Catch the rising fireflies in your glow to feed the flame.',
    'Dodge the rain — every drop steals flame.',
    'If the flame dies, the night wins.',
    'Survive the night to choose a boon. Ember-moths are worth 25.',
    'Steer with the mouse or ← ↑ ↓ → / WASD.  Pause with P.  Mute with M.',
    '',
  ];
  const PAUSED_LINES = ['The rain waits for no one — but it will wait for you.'];
  const BOON_LINES = ['The night is survived. Choose one boon to carry into the dark.'];
  const OVER_LINES = ['', '', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, viewState) {
    time = performance.now();
    const shake = viewState.shake ?? 0;
    const shakeX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const shakeY = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawField(state, viewState.glowRadius, time);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(viewState.best);
      drawPanel('LANTERNFALL', TITLE_LINES, 'Click or press Space to light the lantern');
      return;
    }
    drawHud(state, viewState.best, viewState.muted);
    if (screen === SCREEN_BOON) {
      context.fillStyle = 'rgba(7,10,24,0.55)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      text('Night Survived', FIELD.width / 2, 150, 52, PALETTE.text, 'center');
      for (let index = 0; index < BOON_LINES.length; index += 1) {
        text(BOON_LINES[index], FIELD.width / 2, 196 + index * 30, 22, PALETTE.muted, 'center');
      }
      drawBoonCards(state);
      text('Click a card or press 1, 2 or 3', FIELD.width / 2, CARD.top + CARD.height + 44, 24, '#ffd98a', 'center');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to return to the night');
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(viewState.best);
      OVER_LINES[2] = `Nights survived: ${state.night - 1}   Best combo: ${state.bestCombo}`;
      drawPanel('The Flame Has Died', OVER_LINES, 'Press Space or click to light it again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    toLogical,
    boonCardAt(point) {
      for (const rect of boonRects) {
        if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) return rect.id;
      }
      return null;
    },
  };
}
