import { CONFIG, DEFAULT_CHARACTERS } from './config.js';
import { World }     from './world.js';
import { Character } from './character.js';
import { LLMEngine } from './llm.js';
import { Renderer }  from './renderer.js';

class Game {
  constructor() {
    this.world      = new World();
    this.llm        = new LLMEngine();
    this.characters = [];
    this.renderer   = null;
    this.running    = false;
    this.rafId      = null;
    this.tickCount  = 0;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  init() {
    const canvas = document.getElementById('world-canvas');
    this.renderer = new Renderer(canvas);

    // Restore API key
    const savedKey = localStorage.getItem('aiworld_apikey') || '';
    const keyInput = document.getElementById('api-key-input');
    if (keyInput && savedKey) keyInput.value = savedKey;

    // Add default characters
    DEFAULT_CHARACTERS.forEach(cfg => this.addCharacter(cfg));

    // Bind UI
    this._bindUI();

    // Start
    this.running = true;
    this._startWorldEvents();
    this._gameLoop();

    // Schedule thinking for each character (staggered)
    this.characters.forEach((ch, i) => {
      setTimeout(() => this._scheduleThink(ch), 5000 + i * 8000);
    });

    this._log('🌍 AI World initialized. Characters are waking up...');
  }

  // ── Characters ────────────────────────────────────────────────────────────
  addCharacter(cfg) {
    // Find walkable start
    let sx = cfg.startX, sy = cfg.startY;
    if (!this.world.isWalkable(sx, sy)) {
      outer: for (let r=1; r<10; r++) {
        for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) {
          if (this.world.isWalkable(sx+dx, sy+dy)) { sx+=dx; sy+=dy; break outer; }
        }
      }
    }
    const ch = new Character({ ...cfg, startX: sx, startY: sy });
    this.characters.push(ch);
    this._updateCharacterPanel();
    return ch;
  }

  removeCharacter(id) {
    this.characters = this.characters.filter(ch => {
      if (ch.id === id) { clearTimeout(ch._thinkTimer); return false; }
      return true;
    });
    this._updateCharacterPanel();
  }

  // ── Game Loop ─────────────────────────────────────────────────────────────
  _gameLoop() {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(() => this._gameLoop());
    this.tickCount++;

    // Animate characters
    this.characters.forEach(ch => {
      ch.tickAnimation();
      ch.tickBubble();
    });

    // Render
    this.renderer.render(this.world, this.characters);

    // Update sidebar periodically
    if (this.tickCount % 30 === 0) this._updateEventLog();
  }

  // ── LLM Thinking ─────────────────────────────────────────────────────────
  _scheduleThink(ch) {
    const doThink = async () => {
      if (!this.running) return;
      await this._thinkAndAct(ch);
      ch._thinkTimer = setTimeout(doThink, CONFIG.THINK_INTERVAL);
    };
    doThink();
  }

  async _thinkAndAct(ch) {
    ch.isThinking = true;
    this._log(`💭 ${ch.name} is thinking...`);

    try {
      const worldDesc   = this.world.describe(ch.x, ch.y, 3);
      const nearby      = this.characters.filter(c => c.id !== ch.id &&
        Math.abs(c.x-ch.x) <= 5 && Math.abs(c.y-ch.y) <= 5);
      const result      = await this.llm.think(ch, worldDesc, nearby);

      // Apply thought bubble
      if (result.thought) {
        ch.setBubble(result.thought, 'thought', CONFIG.BUBBLE_DURATION);
        ch.remember(`Thought: "${result.thought.slice(0,60)}..."`);
        this._log(`💬 ${ch.name} thinks: "${result.thought.slice(0,60)}..."`);
      }

      // After brief delay, apply speech + action
      setTimeout(() => {
        if (result.speech) {
          ch.setBubble(result.speech, 'speech', CONFIG.BUBBLE_DURATION * 0.8);
          this._log(`🗣  ${ch.name}: "${result.speech}"`);
        }
        const dir = result.action?.direction || 'stay';
        const moved = ch.applyDirection(dir, this.world);
        const tile  = this.world.getTile(ch.x, ch.y);
        ch.remember(`Moved ${dir} → (${ch.x},${ch.y}) [${tile?.type ?? '?'}]`);
        this._updateCharacterPanel();
      }, 1500);

    } catch(e) {
      console.error('[Game] think error:', e);
    } finally {
      ch.isThinking = false;
    }
  }

  // ── World Events ──────────────────────────────────────────────────────────
  _startWorldEvents() {
    const fire = () => {
      if (!this.running) return;
      this.world.triggerRandomEvent();
      this._updateEventLog();
      setTimeout(fire, CONFIG.WORLD_EVENT_INTERVAL + Math.random() * 10000);
    };
    setTimeout(fire, CONFIG.WORLD_EVENT_INTERVAL);
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  _bindUI() {
    // API key
    const keyInput = document.getElementById('api-key-input');
    const keySave  = document.getElementById('save-key-btn');
    if (keySave) keySave.addEventListener('click', () => {
      this.llm.setApiKey(keyInput.value);
      this._log('✅ API key saved.');
      keySave.textContent = 'Saved!';
      setTimeout(() => { keySave.textContent = 'Save'; }, 1500);
    });

    // Force event
    const eventBtn = document.getElementById('force-event-btn');
    if (eventBtn) eventBtn.addEventListener('click', () => {
      this.world.triggerRandomEvent();
      this._updateEventLog();
    });

    // Force all think
    const thinkBtn = document.getElementById('force-think-btn');
    if (thinkBtn) thinkBtn.addEventListener('click', () => {
      this.characters.forEach(ch => {
        if (!ch.isThinking) this._thinkAndAct(ch);
      });
    });

    // Add character modal
    document.getElementById('add-char-btn')?.addEventListener('click', () => {
      document.getElementById('add-char-modal').style.display = 'flex';
    });
    document.getElementById('modal-cancel')?.addEventListener('click', () => {
      document.getElementById('add-char-modal').style.display = 'none';
    });
    document.getElementById('modal-add')?.addEventListener('click', () => {
      const name    = document.getElementById('new-char-name').value.trim() || 'Wanderer';
      const color   = document.getElementById('new-char-color').value;
      const profile = document.getElementById('new-char-profile').value.trim() ||
        'A mysterious traveler.';
      const prompt  = document.getElementById('new-char-prompt').value.trim() ||
        `You are ${name}, a traveler in this 2D world. Explore and discover.`;

      const bodyClr = this._darken(color);
      const sx = Math.floor(Math.random() * CONFIG.WORLD_WIDTH);
      const sy = Math.floor(Math.random() * CONFIG.WORLD_HEIGHT);

      const ch = this.addCharacter({ name, color, bodyColor: bodyClr, profile,
        systemPrompt: prompt, startX: sx, startY: sy });
      setTimeout(() => this._scheduleThink(ch), 3000);
      document.getElementById('add-char-modal').style.display = 'none';
      this._log(`🆕 ${name} joins the world!`);
    });
  }

  _darken(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, ((n>>16)&0xFF) - 40);
    const g = Math.max(0, ((n>> 8)&0xFF) - 40);
    const b = Math.max(0,  (n     &0xFF) - 40);
    return `#${[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('')}`;
  }

  _log(msg) {
    this.world._log(msg);
    this._updateEventLog();
  }

  _updateEventLog() {
    const el = document.getElementById('event-log');
    if (!el) return;
    el.innerHTML = this.world.eventLog.slice(0, 18).map(e => {
      const age = Math.floor((Date.now() - e.time) / 1000);
      const t   = age < 60 ? `${age}s ago` : `${Math.floor(age/60)}m ago`;
      return `<div class="log-entry"><span class="log-time">${t}</span> ${e.msg}</div>`;
    }).join('');
  }

  _updateCharacterPanel() {
    const el = document.getElementById('char-list');
    if (!el) return;
    el.innerHTML = this.characters.map(ch => `
      <div class="char-card" style="border-left:4px solid ${ch.color}">
        <div class="char-header">
          <span class="char-dot" style="background:${ch.color}"></span>
          <strong>${ch.name}</strong>
          <button class="remove-btn" onclick="game.removeCharacter('${ch.id}')">✕</button>
        </div>
        <div class="char-pos">📍 (${ch.x}, ${ch.y}) · ${this.world.getTile(ch.x,ch.y)?.type??'?'}</div>
        <div class="char-profile">${ch.profile.slice(0,80)}${ch.profile.length>80?'…':''}</div>
        <div class="char-history">
          ${ch.history.slice(0,3).map(h=>`<div class="hist-entry">↳ ${h}</div>`).join('')}
        </div>
      </div>
    `).join('');
  }
}

// Boot
const game = new Game();
window.game = game;
window.addEventListener('DOMContentLoaded', () => game.init());
