// Sound, synthesized live with WebAudio: no audio files, no network calls.
// A soft chime when a firefly is caught (its pitch climbs with the combo),
// a low thud when rain strikes the lantern, a shimmer when a boon is chosen,
// and a quiet two-note pad that hums under the night. Everything is guarded:
// if audio is unavailable the game simply plays silent.

export function createAudio() {
  let context = null;
  let padNodes = null;
  let muted = false;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  /** Unlock audio from a user gesture and start the night pad. */
  function unlock() {
    const ctx = ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (padNodes || muted) return;
    try {
      const gain = ctx.createGain();
      gain.gain.value = 0.035;
      gain.connect(ctx.destination);
      const notes = [110, 164.81, 220];
      const oscillators = notes.map((frequency, index) => {
        const osc = ctx.createOscillator();
        osc.type = index === 0 ? 'sine' : 'triangle';
        osc.frequency.value = frequency;
        osc.detune.value = index === 2 ? 4 : -3;
        osc.connect(gain);
        osc.start();
        return osc;
      });
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      padNodes = { gain, oscillators, lfo };
    } catch {
      padNodes = null;
    }
  }

  function tone({ frequency, type, duration, volume, when = 0, slideTo = null }) {
    const ctx = ensure();
    if (!ctx || muted) return;
    try {
      const start = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, start);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    } catch {
      // A failed note never stops the game.
    }
  }

  return {
    unlock,
    /** A firefly's chime; higher combo, higher and brighter note. */
    catch(combo) {
      const base = 523.25 * (1 + 0.09 * (combo - 1));
      tone({ frequency: base, type: 'sine', duration: 0.35, volume: 0.16 });
      tone({ frequency: base * 2, type: 'sine', duration: 0.22, volume: 0.05 });
    },
    /** An ember-moth's richer two-note chime. */
    moth() {
      tone({ frequency: 659.25, type: 'triangle', duration: 0.4, volume: 0.16 });
      tone({ frequency: 987.77, type: 'sine', duration: 0.5, volume: 0.12, when: 0.07 });
    },
    /** Rain striking the lantern: a dull thud and a falling tone. */
    rainHit() {
      tone({ frequency: 150, type: 'triangle', duration: 0.22, volume: 0.22, slideTo: 70 });
      tone({ frequency: 90, type: 'sine', duration: 0.3, volume: 0.14, slideTo: 55 });
    },
    /** A raindrop blocked by the Raincloak: a soft wooden knock. */
    blocked() {
      tone({ frequency: 320, type: 'square', duration: 0.08, volume: 0.06 });
    },
    /** A boon chosen: a rising three-note shimmer. */
    boon() {
      [523.25, 659.25, 783.99].forEach((frequency, index) => {
        tone({ frequency, type: 'sine', duration: 0.5, volume: 0.12, when: index * 0.08 });
      });
    },
    /** The night ends: a gentle two-note sigh. */
    nightEnd() {
      tone({ frequency: 392, type: 'sine', duration: 0.6, volume: 0.1 });
      tone({ frequency: 293.66, type: 'sine', duration: 0.8, volume: 0.1, when: 0.18 });
    },
    /** The flame dies: a low fading drone. */
    gameOver() {
      tone({ frequency: 220, type: 'sawtooth', duration: 1.4, volume: 0.07, slideTo: 55 });
      tone({ frequency: 110, type: 'sine', duration: 1.6, volume: 0.1, slideTo: 40 });
    },
    toggleMute() {
      muted = !muted;
      if (padNodes) padNodes.gain.gain.value = muted ? 0 : 0.035;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
