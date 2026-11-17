// Keyboard and pointer input. Held keys steer the lantern; one-shot presses
// (start, restart, pause, mute, boon choice) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost and never
// counted twice. The pointer steers too: the lantern eases toward the mouse,
// and a click counts as confirm (and picks a boon card when one is shown).

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const BOON_KEYS = new Map([['Digit1', 0], ['Digit2', 1], ['Digit3', 2], ['Numpad1', 0], ['Numpad2', 1], ['Numpad3', 2]]);

export function createInput(target) {
  const keys = { left: false, right: false, up: false, down: false };
  let actions = 0;
  let boonPick = -1;
  /** Pointer position in CSS pixels, or null when the pointer never moved. */
  let pointer = null;
  let pointerActive = false;
  let click = null;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (BOON_KEYS.has(event.code)) {
      if (!event.repeat) boonPick = BOON_KEYS.get(event.code);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
    else if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    keys.left = keys.right = keys.up = keys.down = false;
    pointerActive = false;
  });
  target.addEventListener('pointermove', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    pointerActive = true;
  });
  target.addEventListener('pointerdown', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    pointerActive = true;
    click = { x: event.clientX, y: event.clientY };
    actions |= ACTION_CONFIRM;
  });

  return {
    /** Steering from held keys: each component in -1..1. */
    keySteer() {
      return {
        x: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
        y: (keys.down ? 1 : 0) - (keys.up ? 1 : 0),
      };
    },
    /** Where the pointer is, in CSS pixels, when it has moved or clicked. */
    pointerPosition() {
      return pointerActive ? pointer : null;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeBoonPick() {
      const pick = boonPick;
      boonPick = -1;
      return pick;
    },
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
