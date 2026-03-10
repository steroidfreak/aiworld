import { CONFIG } from './config.js';

export class Character {
  constructor({ name, color, bodyColor, systemPrompt, profile, startX, startY }) {
    this.id          = `char_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    this.name        = name;
    this.color       = color;       // primary color (outfit/hat)
    this.bodyColor   = bodyColor;   // secondary color (pants/darker)
    this.systemPrompt = systemPrompt;
    this.profile     = profile;

    // Grid position
    this.x = startX;
    this.y = startY;

    // Pixel position for smooth animation
    this.px = startX * CONFIG.TILE_SIZE;
    this.py = startY * CONFIG.TILE_SIZE;

    // Animation
    this.animStep   = 0;   // walk frame counter
    this.isMoving   = false;
    this.facing     = 'south'; // north/south/east/west

    // Bubble system
    this.bubble     = null; // { text, type:'thought'|'speech', created, expires }
    this.isThinking = false; // spinner while calling LLM

    // Memory
    this.history    = [];    // recent action strings
    this.mood       = 'neutral';
  }

  // ── Bubble ───────────────────────────────────────────────────────────────
  setBubble(text, type = 'speech', duration = CONFIG.BUBBLE_DURATION) {
    this.bubble = {
      text,
      type,
      created : Date.now(),
      expires : Date.now() + duration,
      alpha   : 1,
    };
  }

  tickBubble() {
    if (!this.bubble) return;
    const age = Date.now() - this.bubble.created;
    const dur = this.bubble.expires - this.bubble.created;
    if (age >= dur) { this.bubble = null; return; }
    // Fade in last 6s
    const fadeStart = dur - 6000;
    this.bubble.alpha = age > fadeStart ? 1 - (age - fadeStart) / 6000 : 1;
  }

  // ── Memory ───────────────────────────────────────────────────────────────
  remember(entry) {
    this.history.unshift(entry);
    if (this.history.length > CONFIG.MAX_HISTORY) this.history.pop();
  }

  historyText() {
    if (!this.history.length) return 'Nothing yet. You just arrived.';
    return this.history.map((h, i) => `${i+1}. ${h}`).join('\n');
  }

  // ── Animation ────────────────────────────────────────────────────────────
  tickAnimation() {
    const T = CONFIG.TILE_SIZE;
    const tx = this.x * T;
    const ty = this.y * T;
    const dx = tx - this.px;
    const dy = ty - this.py;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist > 0.5) {
      this.isMoving = true;
      const speed = CONFIG.MOVE_SPEED;
      this.px += (dx / dist) * Math.min(speed, dist);
      this.py += (dy / dist) * Math.min(speed, dist);
      this.animStep++;
    } else {
      this.px = tx;
      this.py = ty;
      this.isMoving = false;
    }
  }

  // ── Movement ─────────────────────────────────────────────────────────────
  applyDirection(dir, world) {
    const moves = {
      north: [0, -1], south: [0,  1],
      east:  [1,  0], west:  [-1, 0],
      stay:  [0,  0],
    };
    const [dx, dy] = moves[dir] || [0,0];
    if (dx !== 0 || dy !== 0) this.facing = dir;

    const nx = this.x + dx;
    const ny = this.y + dy;
    if (world.isWalkable(nx, ny)) {
      this.x = nx;
      this.y = ny;
      return true;
    }
    return false;
  }
}
