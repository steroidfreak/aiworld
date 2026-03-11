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
    this.music      = null;
    this.progress   = {
      level: 1,
      xp: 0,
      xpToNext: 100,
      weatherEvents: 0,
      socialTurns: 0,
      discoveredTiles: new Set(),
    };
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
    this._updateProgressUI();

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
      const nearbyCount = this.characters.filter(c => c.id !== ch.id && Math.abs(c.x-ch.x) <= 2 && Math.abs(c.y-ch.y) <= 2).length;
      const tileType = this.world.getTile(ch.x, ch.y)?.type;
      ch.tickNeeds(tileType, nearbyCount);
      this._registerDiscovery(ch);
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
      if (nearby.length > 0 && (result.speech || result.thought)) this._awardSocialTurn();
      ch.applyLifeUpdate(result);

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
        if (moved) this._gainXP(2, `Exploration: ${ch.name} moved`);
        ch.remember(`${result.activity || 'Moved'} (${dir}) → (${ch.x},${ch.y}) [${tile?.type ?? '?'}]`);
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
      this._awardWeatherEvent();
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
      this._awardWeatherEvent();
      this._updateEventLog();
    });

    // Force all think
    const thinkBtn = document.getElementById('force-think-btn');
    if (thinkBtn) thinkBtn.addEventListener('click', () => {
      this.characters.forEach(ch => {
        if (!ch.isThinking) this._thinkAndAct(ch);
      });
    });

    // Music toggle
    const musicBtn = document.getElementById('music-toggle-btn');
    if (musicBtn) musicBtn.addEventListener('click', async () => {
      const enabled = await this._toggleMusic();
      musicBtn.textContent = enabled ? '🎵 Music: On' : '🎵 Music: Off';
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

  async _toggleMusic() {
    if (!this.music) {
      this.music = this._buildMusic();
    }

    if (this.music.enabled) {
      this.music.stop();
      return false;
    }

    await this.music.start();
    return true;
  }

  _buildMusic() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      this._log('⚠️ Web Audio is not available in this browser.');
      return { enabled: false, start: async () => {}, stop: () => {} };
    }

    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0.06;
    master.connect(ctx.destination);

    const nodes = [];
    const makeVoice = (type, freq, gainValue, lfoHz) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.value = gainValue;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = lfoHz;

      const lfoGain = ctx.createGain();
      lfoGain.gain.value = gainValue * 0.35;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);

      osc.connect(gain);
      gain.connect(master);

      nodes.push(osc, gain, lfo, lfoGain);
      return { osc, lfo };
    };

    const pad1 = makeVoice('triangle', 196.0, 0.35, 0.07);
    const pad2 = makeVoice('sine', 246.94, 0.22, 0.05);
    const drone = makeVoice('sawtooth', 98.0, 0.08, 0.03);

    let shimmerInterval = null;
    let enabled = false;

    const start = async () => {
      if (enabled) return;
      if (ctx.state === 'suspended') await ctx.resume();

      [pad1, pad2, drone].forEach(v => {
        v.osc.start();
        v.lfo.start();
      });

      shimmerInterval = setInterval(() => {
        const now = ctx.currentTime;
        const notePool = [261.63, 293.66, 329.63, 392.0];
        const note = notePool[Math.floor(Math.random() * notePool.length)];
        pad2.osc.frequency.setTargetAtTime(note * 0.5, now, 2.6);
      }, 6000);

      enabled = true;
    };

    const stop = () => {
      if (!enabled) return;
      if (shimmerInterval) clearInterval(shimmerInterval);
      shimmerInterval = null;
      nodes.forEach(n => {
        try { n.disconnect(); } catch (_) {}
      });
      try { ctx.close(); } catch (_) {}
      enabled = false;
      this.music = null;
    };

    return {
      get enabled() { return enabled; },
      start,
      stop,
    };
  }


  _registerDiscovery(ch) {
    const tile = this.world.getTile(ch.x, ch.y);
    if (!tile) return;
    const key = `${tile.type}_${ch.x}_${ch.y}`;
    if (this.progress.discoveredTiles.has(key)) return;
    this.progress.discoveredTiles.add(key);
    this._gainXP(4, `${ch.name} discovered a new place`);
    this._updateProgressUI();
  }

  _awardWeatherEvent() {
    this.progress.weatherEvents++;
    this._gainXP(10, 'World event survived');
    this._updateProgressUI();
  }

  _awardSocialTurn() {
    this.progress.socialTurns++;
    this._gainXP(6, 'A social interaction happened');
    this._updateProgressUI();
  }

  _gainXP(amount, reason = 'Progress') {
    this.progress.xp += amount;
    let leveled = false;
    while (this.progress.xp >= this.progress.xpToNext) {
      this.progress.xp -= this.progress.xpToNext;
      this.progress.level++;
      this.progress.xpToNext = Math.round(this.progress.xpToNext * 1.22);
      leveled = true;
    }
    if (leveled) this._log(`🏆 World leveled up! You reached Lv.${this.progress.level}.`);
    if (reason) this.world._log(`✨ +${amount} XP · ${reason}`);
    this._updateProgressUI();
  }

  _updateProgressUI() {
    const levelEl = document.getElementById('world-level');
    const fillEl = document.getElementById('xp-fill');
    const xpLabelEl = document.getElementById('xp-label');
    const rankEl = document.getElementById('story-rank');
    const weatherEl = document.getElementById('quest-weather');
    const socialEl = document.getElementById('quest-social');
    const exploreEl = document.getElementById('quest-explore');

    if (!levelEl || !fillEl || !xpLabelEl) return;
    const pct = Math.max(0, Math.min(100, (this.progress.xp / this.progress.xpToNext) * 100));
    levelEl.textContent = `Lv.${this.progress.level}`;
    fillEl.style.width = `${pct}%`;
    xpLabelEl.textContent = `${Math.floor(this.progress.xp)} / ${this.progress.xpToNext} XP`;

    if (rankEl) {
      const ranks = ['Dreamer', 'Builder', 'Strategist', 'Legend'];
      rankEl.textContent = `Rank: ${ranks[Math.min(ranks.length - 1, Math.floor((this.progress.level - 1) / 2))]}`;
    }

    if (weatherEl) {
      const count = Math.min(2, this.progress.weatherEvents);
      weatherEl.textContent = `☁️ Survive 2 world events (${count}/2)`;
      weatherEl.classList.toggle('done', this.progress.weatherEvents >= 2);
    }
    if (socialEl) {
      const count = Math.min(3, this.progress.socialTurns);
      socialEl.textContent = `🗣 Trigger 3 social turns (${count}/3)`;
      socialEl.classList.toggle('done', this.progress.socialTurns >= 3);
    }
    if (exploreEl) {
      const count = Math.min(6, this.progress.discoveredTiles.size);
      exploreEl.textContent = `🧭 Visit 6 unique tiles (${count}/6)`;
      exploreEl.classList.toggle('done', this.progress.discoveredTiles.size >= 6);
    }
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
        <div class="char-mood">🙂 ${ch.mood} · ${ch.activity}</div>
        <div class="char-profile">${ch.profile.slice(0,80)}${ch.profile.length>80?'…':''}</div>
        <div class="needs-grid">
          ${Object.entries(ch.needs).map(([k,v]) => `
            <div class="need-row">
              <span>${k}</span>
              <div class="need-bar"><i style="width:${Math.round(v)}%"></i></div>
            </div>
          `).join('')}
        </div>
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
