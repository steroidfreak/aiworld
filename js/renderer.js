import { TILE, CONFIG } from './config.js';

const T = CONFIG.TILE_SIZE; // 32

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.tick   = 0;
    canvas.width  = CONFIG.WORLD_WIDTH  * T;
    canvas.height = CONFIG.WORLD_HEIGHT * T;
  }

  render(world, characters) {
    this.tick++;
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this._drawWorld(world);
    this._drawGrid();

    // Sort characters by y so "closer" ones draw on top
    const sorted = [...characters].sort((a,b) => a.y - b.y);
    sorted.forEach(ch => {
      this._drawCharacter(ch);
    });
    // Bubbles drawn on top of all characters
    sorted.forEach(ch => {
      if (ch.isThinking) this._drawThinkingIndicator(ch);
      else if (ch.bubble) this._drawBubble(ch);
    });
  }

  // ── World ────────────────────────────────────────────────────────────────
  _drawWorld(world) {
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = world.grid[y][x];
        if (tile) this._drawTile(this.ctx, x, y, tile.type);
      }
    }
  }

  _drawGrid() {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth   = 0.5;
    for (let x = 0; x <= CONFIG.WORLD_WIDTH; x++) {
      ctx.beginPath(); ctx.moveTo(x*T, 0); ctx.lineTo(x*T, CONFIG.WORLD_HEIGHT*T); ctx.stroke();
    }
    for (let y = 0; y <= CONFIG.WORLD_HEIGHT; y++) {
      ctx.beginPath(); ctx.moveTo(0, y*T); ctx.lineTo(CONFIG.WORLD_WIDTH*T, y*T); ctx.stroke();
    }
  }

  _drawTile(ctx, gx, gy, type) {
    const px = gx * T, py = gy * T;
    const info = TILE[type];
    if (!info) { ctx.fillStyle='#222'; ctx.fillRect(px,py,T,T); return; }

    ctx.fillStyle = info.color;
    ctx.fillRect(px, py, T, T);

    // Tile-specific decoration
    switch(type) {
      case 'GRASS':    this._tileGrass   (ctx, px, py); break;
      case 'WATER':    this._tileWater   (ctx, px, py); break;
      case 'TREE':     this._tileTree    (ctx, px, py); break;
      case 'ROCK':     this._tileRock    (ctx, px, py); break;
      case 'PATH':     this._tilePath    (ctx, px, py); break;
      case 'HOUSE':    this._tileHouse   (ctx, px, py); break;
      case 'MOUNTAIN': this._tileMountain(ctx, px, py); break;
      case 'FLOWER':   this._tileFlower  (ctx, px, py); break;
      case 'SAND':     this._tileSand    (ctx, px, py); break;
      case 'FIRE':     this._tileFire    (ctx, px, py); break;
      case 'SNOW':     this._tileSnow    (ctx, px, py); break;
      case 'ICE':      this._tileIce     (ctx, px, py); break;
      case 'RUINS':    this._tileRuins   (ctx, px, py); break;
      case 'MUSHROOM': this._tileMushroom(ctx, px, py); break;
    }
  }

  _tileGrass(ctx, px, py) {
    ctx.fillStyle = '#3A6430';
    // small grass blades
    [[6,22],[12,20],[18,23],[24,21],[9,26],[20,26]].forEach(([x,y]) => {
      ctx.fillRect(px+x,   py+y-5, 2, 5);
      ctx.fillRect(px+x-2, py+y-3, 2, 3);
      ctx.fillRect(px+x+2, py+y-3, 2, 3);
    });
  }

  _tileWater(ctx, px, py) {
    const t = this.tick * 0.05;
    ctx.strokeStyle = 'rgba(150,210,255,0.5)';
    ctx.lineWidth = 1.5;
    [8,18,28].forEach((wy, i) => {
      ctx.beginPath();
      for (let wx = 0; wx <= T; wx += 4) {
        const wvy = wy + Math.sin((wx*0.3) + t + i*1.2) * 2;
        wx === 0 ? ctx.moveTo(px+wx, py+wvy) : ctx.lineTo(px+wx, py+wvy);
      }
      ctx.stroke();
    });
  }

  _tileTree(ctx, px, py) {
    // Trunk
    ctx.fillStyle = '#4A2E0A';
    ctx.fillRect(px+12, py+22, 8, 10);
    // Crown layers
    [[16,22,14],[16,16,12],[16,10,9]].forEach(([cx,cy,r]) => {
      ctx.fillStyle = '#1E4A14';
      ctx.beginPath(); ctx.arc(px+cx, py+cy, r, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2D6B1E';
      ctx.beginPath(); ctx.arc(px+cx-2, py+cy-2, r*0.6, 0, Math.PI*2); ctx.fill();
    });
  }

  _tileRock(ctx, px, py) {
    ctx.fillStyle = '#4A4A4A';
    ctx.beginPath();
    ctx.moveTo(px+8, py+26); ctx.lineTo(px+4, py+22);
    ctx.lineTo(px+10, py+12); ctx.lineTo(px+22, py+10);
    ctx.lineTo(px+28, py+16); ctx.lineTo(px+26, py+26);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#888';
    ctx.fillRect(px+12, py+14, 6, 4);
  }

  _tilePath(ctx, px, py) {
    ctx.fillStyle = '#9A7D50';
    // Cobble marks
    [[4,6,10,10],[14,4,10,10],[4,18,10,10],[14,16,10,10]].forEach(([x,y,w,h]) => {
      ctx.fillRect(px+x, py+y, w, h);
    });
    ctx.strokeStyle = '#7A5D30';
    ctx.lineWidth = 0.5;
    [[4,6,10,10],[14,4,10,10],[4,18,10,10],[14,16,10,10]].forEach(([x,y,w,h]) => {
      ctx.strokeRect(px+x, py+y, w, h);
    });
  }

  _tileHouse(ctx, px, py) {
    // Walls
    ctx.fillStyle = '#D4A574';
    ctx.fillRect(px+4, py+14, 24, 18);
    // Roof
    ctx.fillStyle = '#CC3311';
    ctx.beginPath();
    ctx.moveTo(px+2, py+14); ctx.lineTo(px+16, py+4); ctx.lineTo(px+30, py+14);
    ctx.closePath(); ctx.fill();
    // Door
    ctx.fillStyle = '#5A3010';
    ctx.fillRect(px+12, py+22, 8, 10);
    // Window
    ctx.fillStyle = '#88CCFF';
    ctx.fillRect(px+6, py+16, 6, 6);
    ctx.strokeStyle = '#5A3010'; ctx.lineWidth = 1;
    ctx.strokeRect(px+6, py+16, 6, 6);
    ctx.moveTo(px+9, py+16); ctx.lineTo(px+9, py+22); ctx.stroke();
    ctx.moveTo(px+6, py+19); ctx.lineTo(px+12, py+19); ctx.stroke();
  }

  _tileMountain(ctx, px, py) {
    ctx.fillStyle = '#3A4A5A';
    ctx.beginPath();
    ctx.moveTo(px+16, py+2); ctx.lineTo(px+30, py+30); ctx.lineTo(px+2, py+30);
    ctx.closePath(); ctx.fill();
    // Snow cap
    ctx.fillStyle = '#E8ECEE';
    ctx.beginPath();
    ctx.moveTo(px+16, py+2); ctx.lineTo(px+22, py+12); ctx.lineTo(px+10, py+12);
    ctx.closePath(); ctx.fill();
  }

  _tileFlower(ctx, px, py) {
    this._tileGrass(ctx, px, py);
    [[8,20],[16,14],[22,22],[12,28],[24,10]].forEach(([x,y]) => {
      ctx.fillStyle = '#FFCC00';
      ctx.beginPath(); ctx.arc(px+x, py+y, 3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#FF8800';
      ctx.beginPath(); ctx.arc(px+x, py+y, 1.5, 0, Math.PI*2); ctx.fill();
    });
  }

  _tileSand(ctx, px, py) {
    ctx.fillStyle = '#BFA070';
    // Dots
    [[5,8],[11,5],[19,10],[26,6],[8,18],[16,22],[24,20],[4,26],[20,28]].forEach(([x,y]) => {
      ctx.fillRect(px+x, py+y, 2, 2);
    });
  }

  _tileFire(ctx, px, py) {
    const t = this.tick * 0.1;
    const flames = [[8,28,6,20],[14,28,6,16],[20,28,6,22],[5,28,4,14],[24,28,4,18]];
    flames.forEach(([bx,by,w,h]) => {
      const flicker = Math.sin(t + bx) * 3;
      const grad = this.ctx.createLinearGradient(px+bx, py+by, px+bx, py+by-h+flicker);
      grad.addColorStop(0, '#CC2200');
      grad.addColorStop(0.4, '#FF8800');
      grad.addColorStop(1, 'rgba(255,255,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(px+bx, py+by);
      ctx.lineTo(px+bx+w*0.5+flicker, py+by-h+flicker);
      ctx.lineTo(px+bx+w, py+by);
      ctx.closePath();
      ctx.fill();
    });
  }

  _tileSnow(ctx, px, py) {
    ctx.fillStyle = '#AABBCC';
    [[6,6],[16,10],[24,6],[10,20],[20,22],[4,28],[28,24]].forEach(([x,y]) => {
      // Snowflake cross
      ctx.fillRect(px+x-1, py+y-3, 2, 6);
      ctx.fillRect(px+x-3, py+y-1, 6, 2);
    });
  }

  _tileIce(ctx, px, py) {
    ctx.strokeStyle = 'rgba(180,220,255,0.6)';
    ctx.lineWidth   = 1;
    [[4,8,26,8],[8,12,16,20],[4,22,26,22]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath();
      ctx.moveTo(px+x1, py+y1); ctx.lineTo(px+x2, py+y2);
      ctx.stroke();
    });
  }

  _tileRuins(ctx, px, py) {
    ctx.fillStyle = '#554433';
    [[2,22,8,10],[22,22,8,10],[2,22,28,4]].forEach(([x,y,w,h]) => {
      ctx.fillRect(px+x, py+y, w, h);
    });
    ctx.fillStyle = '#443322';
    ctx.fillRect(px+4, py+20, 4, 2);
    ctx.fillRect(px+24, py+20, 4, 2);
  }

  _tileMushroom(ctx, px, py) {
    this._tileGrass(ctx, px, py);
    [[8,22],[20,18],[16,26]].forEach(([cx,cy]) => {
      // Stem
      ctx.fillStyle = '#DDBB88';
      ctx.fillRect(cx+px-2, cy+py-2, 4, 6);
      // Cap
      ctx.fillStyle = '#CC4444';
      ctx.beginPath(); ctx.arc(cx+px, cy+py-4, 6, Math.PI, 0); ctx.fill();
      // Dots
      ctx.fillStyle = '#FFDDDD';
      ctx.fillRect(cx+px-2, cy+py-6, 2, 2);
      ctx.fillRect(cx+px+1, cy+py-4, 2, 2);
    });
  }

  // ── Character ────────────────────────────────────────────────────────────
  _drawCharacter(ch) {
    const ctx   = this.ctx;
    const cx    = ch.px + T/2;
    const cy    = ch.py + T/2 + 2;
    const walk  = ch.isMoving ? Math.sin(ch.animStep * 0.4) * 2 : 0;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(cx, cy+12, 7, 3, 0, 0, Math.PI*2); ctx.fill();

    // Legs
    ctx.fillStyle = ch.bodyColor;
    ctx.fillRect(cx-5, cy+4, 4, 8 + (walk > 0 ? walk : 0));
    ctx.fillRect(cx+1, cy+4, 4, 8 - (walk > 0 ? walk : 0));

    // Body / tunic
    ctx.fillStyle = ch.color;
    ctx.fillRect(cx-6, cy-4, 12, 10);

    // Belt
    ctx.fillStyle = ch.bodyColor;
    ctx.fillRect(cx-6, cy+4, 12, 2);

    // Head
    ctx.fillStyle = '#FDBCB4';
    ctx.beginPath(); ctx.arc(cx, cy-11, 7, 0, Math.PI*2); ctx.fill();

    // Eyes
    ctx.fillStyle = '#333';
    if (ch.facing === 'west') {
      ctx.fillRect(cx-5, cy-13, 2, 2);
      ctx.fillRect(cx-1, cy-13, 2, 2);
    } else if (ch.facing === 'east') {
      ctx.fillRect(cx-1, cy-13, 2, 2);
      ctx.fillRect(cx+3, cy-13, 2, 2);
    } else if (ch.facing === 'north') {
      ctx.fillRect(cx-3, cy-14, 2, 2);
      ctx.fillRect(cx+1, cy-14, 2, 2);
    } else {
      ctx.fillRect(cx-3, cy-12, 2, 2);
      ctx.fillRect(cx+1, cy-12, 2, 2);
    }

    // Name tag
    ctx.font      = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(ch.name, cx+1, cy-22+1);
    ctx.fillStyle = '#FFF';
    ctx.fillText(ch.name, cx, cy-22);
  }

  // ── Bubbles ───────────────────────────────────────────────────────────────
  _drawBubble(ch) {
    const { ctx } = this;
    const { bubble } = ch;
    if (!bubble || bubble.alpha <= 0) return;

    const cx = ch.px + T/2;
    const cy = ch.py;

    // Measure text
    ctx.font = bubble.type === 'thought' ? 'italic 10px monospace' : '10px monospace';
    const maxW    = 140;
    const lines   = this._wrapText(bubble.text, maxW, ctx);
    const lineH   = 14;
    const padding = 8;
    const bw      = Math.min(maxW, this._maxLineWidth(lines, ctx)) + padding*2;
    const bh      = lines.length * lineH + padding*2;

    let bx = cx - bw/2;
    let by = cy - bh - 28;

    // Clamp to canvas
    bx = Math.max(4, Math.min(this.canvas.width  - bw - 4, bx));
    by = Math.max(4, Math.min(this.canvas.height - bh - 4, by));

    ctx.save();
    ctx.globalAlpha = bubble.alpha;

    if (bubble.type === 'thought') {
      this._drawThoughtBubble(ctx, bx, by, bw, bh, cx, cy - 26);
    } else {
      this._drawSpeechBubble(ctx, bx, by, bw, bh, cx, cy - 26);
    }

    // Text
    ctx.fillStyle   = '#111';
    ctx.font        = bubble.type === 'thought' ? 'italic 10px monospace' : '10px monospace';
    ctx.textAlign   = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
      ctx.fillText(line, bx + padding, by + padding + i * lineH);
    });

    ctx.restore();
  }

  _drawSpeechBubble(ctx, bx, by, bw, bh, tailX, tailY) {
    const r = 8;
    ctx.fillStyle   = 'rgba(255,255,240,0.95)';
    ctx.strokeStyle = '#333';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(bx+r, by);
    ctx.lineTo(bx+bw-r, by);
    ctx.arcTo(bx+bw, by, bx+bw, by+r, r);
    ctx.lineTo(bx+bw, by+bh-r);
    ctx.arcTo(bx+bw, by+bh, bx+bw-r, by+bh, r);
    // Tail
    const tx = Math.max(bx+r, Math.min(bx+bw-r, tailX));
    ctx.lineTo(tx+8, by+bh);
    ctx.lineTo(tailX, tailY + 4);
    ctx.lineTo(tx-8, by+bh);
    ctx.lineTo(bx+r, by+bh);
    ctx.arcTo(bx, by+bh, bx, by+bh-r, r);
    ctx.lineTo(bx, by+r);
    ctx.arcTo(bx, by, bx+r, by, r);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  _drawThoughtBubble(ctx, bx, by, bw, bh, tailX, tailY) {
    const r = 10;
    ctx.fillStyle   = 'rgba(240,245,255,0.93)';
    ctx.strokeStyle = '#556';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(bx+r, by);
    ctx.lineTo(bx+bw-r, by);
    ctx.arcTo(bx+bw, by, bx+bw, by+r, r);
    ctx.lineTo(bx+bw, by+bh-r);
    ctx.arcTo(bx+bw, by+bh, bx+bw-r, by+bh, r);
    ctx.lineTo(bx+r, by+bh);
    ctx.arcTo(bx, by+bh, bx, by+bh-r, r);
    ctx.lineTo(bx, by+r);
    ctx.arcTo(bx, by, bx+r, by, r);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);

    // Thought dots
    [[0,0,4],[0,0,3],[0,0,2]].forEach((_, i) => {
      const dot = 4 - i;
      const dx  = tailX;
      const dy  = tailY + 4 + i * 6;
      ctx.fillStyle = 'rgba(240,245,255,0.93)';
      ctx.beginPath(); ctx.arc(dx, dy, dot, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#556'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(dx, dy, dot, 0, Math.PI*2); ctx.stroke();
    });
  }

  _drawThinkingIndicator(ch) {
    const ctx = this.ctx;
    const cx  = ch.px + T/2;
    const cy  = ch.py - 6;
    const t   = this.tick * 0.12;
    ctx.font      = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx-18, cy-16, 36, 16);
    ctx.fillStyle = '#FFD700';
    ctx.fillText(['...', '·..', '··.', '···'][Math.floor(t) % 4], cx, cy-4);
  }

  // ── Text wrapping helpers ─────────────────────────────────────────────────
  _wrapText(text, maxW, ctx) {
    const words  = text.split(' ');
    const lines  = [];
    let current  = '';
    words.forEach(w => {
      const test = current ? current + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && current) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  _maxLineWidth(lines, ctx) {
    return lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
  }
}
