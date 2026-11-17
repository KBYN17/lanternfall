// Sparks and floating score popups. One fixed pool, allocated once at boot,
// so a busy catch never allocates mid-frame: each burst reuses dead slots,
// and a burst that finds no free slot simply makes fewer sparks.

export function createParticles(capacity = 256) {
  const sparks = [];
  const popups = [];
  for (let i = 0; i < capacity; i += 1) {
    sparks.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff' });
  }
  for (let i = 0; i < 24; i += 1) {
    popups.push({ alive: false, x: 0, y: 0, life: 0, maxLife: 1, text: '' });
  }

  function burst(x, y, color, count, speed = 160) {
    let made = 0;
    for (let i = 0; i < sparks.length && made < count; i += 1) {
      const spark = sparks[i];
      if (spark.alive) continue;
      const angle = Math.random() * Math.PI * 2;
      const power = speed * (0.35 + Math.random() * 0.65);
      spark.alive = true;
      spark.x = x;
      spark.y = y;
      spark.vx = Math.cos(angle) * power;
      spark.vy = Math.sin(angle) * power - 40;
      spark.maxLife = 0.45 + Math.random() * 0.35;
      spark.life = spark.maxLife;
      spark.size = 1.5 + Math.random() * 2.5;
      spark.color = color;
      made += 1;
    }
  }

  function popup(x, y, text) {
    for (const item of popups) {
      if (item.alive) continue;
      item.alive = true;
      item.x = x;
      item.y = y;
      item.maxLife = 0.9;
      item.life = item.maxLife;
      item.text = text;
      return;
    }
  }

  function step(dt) {
    for (const spark of sparks) {
      if (!spark.alive) continue;
      spark.life -= dt;
      if (spark.life <= 0) {
        spark.alive = false;
        continue;
      }
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vy += 260 * dt;
      spark.vx *= 1 - 1.6 * dt;
    }
    for (const item of popups) {
      if (!item.alive) continue;
      item.life -= dt;
      if (item.life <= 0) item.alive = false;
      else item.y -= 42 * dt;
    }
  }

  return { sparks, popups, burst, popup, step };
}
