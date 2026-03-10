import { TILE, CONFIG } from './config.js';

export class World {
  constructor() {
    this.width  = CONFIG.WORLD_WIDTH;
    this.height = CONFIG.WORLD_HEIGHT;
    this.grid   = [];
    this.events = [];
    this.weather = 'clear';
    this.eventLog = [];
    this._fireTimers = [];
    this.generate();
  }

  // ── Terrain Generation ───────────────────────────────────────────────────
  generate() {
    this.grid = Array.from({ length: this.height }, (_, y) =>
      Array.from({ length: this.width  }, (_, x) => ({ type: this._noiseTile(x, y) }))
    );
    this._placePaths();
    this._placeStructures();
  }

  _noiseTile(x, y) {
    const r = Math.random();
    if (r < 0.38) return 'GRASS';
    if (r < 0.52) return 'TREE';
    if (r < 0.62) return 'WATER';
    if (r < 0.68) return 'ROCK';
    if (r < 0.74) return 'FLOWER';
    if (r < 0.79) return 'SAND';
    if (r < 0.83) return 'MOUNTAIN';
    if (r < 0.86) return 'MUSHROOM';
    return 'GRASS';
  }

  _placePaths() {
    const py = Math.floor(this.height / 2);
    const px = Math.floor(this.width  / 2);
    for (let x = 0; x < this.width;  x++) this.grid[py][x] = { type: 'PATH' };
    for (let y = 0; y < this.height; y++) this.grid[y][px] = { type: 'PATH' };
    // Diagonal shortcut
    for (let i = 0; i < 6; i++) {
      const bx = 2 + i, by = 2 + i;
      if (this._valid(bx, by)) this.grid[by][bx] = { type: 'PATH' };
    }
  }

  _placeStructures() {
    const houseSpots = [[3,3],[3,16],[16,3],[16,16],[9,2],[2,9]];
    houseSpots.forEach(([x,y]) => {
      if (this._valid(x,y)) this.grid[y][x] = { type: 'HOUSE' };
    });
    // A few ruins
    for (let i = 0; i < 3; i++) {
      const x = 1 + Math.floor(Math.random() * (this.width-2));
      const y = 1 + Math.floor(Math.random() * (this.height-2));
      if (this._valid(x,y)) this.grid[y][x] = { type: 'RUINS' };
    }
  }

  // ── Tile Access ──────────────────────────────────────────────────────────
  _valid(x, y) { return x>=0 && x<this.width && y>=0 && y<this.height; }

  getTile(x, y) {
    if (!this._valid(x,y)) return null;
    return this.grid[y][x];
  }

  setTile(x, y, type) {
    if (!this._valid(x,y)) return;
    this.grid[y][x] = { type };
  }

  isWalkable(x, y) {
    const t = this.getTile(x, y);
    return t ? (TILE[t.type]?.walk ?? false) : false;
  }

  // ── Random World Events ──────────────────────────────────────────────────
  triggerRandomEvent() {
    const events = [
      this._evStorm, this._evBloom, this._evFire, this._evDrought,
      this._evSnowfall, this._evEarthquake, this._evMeteor,
      this._evMushrooms, this._evSpring,
    ];
    const fn = events[Math.floor(Math.random() * events.length)].bind(this);
    fn();
  }

  _evStorm() {
    const n = 3 + Math.floor(Math.random() * 6);
    for (let i=0;i<n;i++) {
      const x = Math.floor(Math.random()*this.width);
      const y = Math.floor(Math.random()*this.height);
      if (this.grid[y][x].type === 'GRASS') this.setTile(x, y, 'WATER');
      if (this.grid[y][x].type === 'SAND')  this.setTile(x, y, 'WATER');
    }
    this.weather = 'stormy';
    this._log('⛈  A fierce storm floods the lowlands!');
    setTimeout(() => { this.weather = 'clear'; }, 18000);
  }

  _evBloom() {
    const n = 6 + Math.floor(Math.random() * 8);
    for (let i=0;i<n;i++) {
      const x = Math.floor(Math.random()*this.width);
      const y = Math.floor(Math.random()*this.height);
      if (this.grid[y][x].type === 'GRASS') this.setTile(x, y, 'FLOWER');
    }
    this._log('🌸 Spring bloom! Flowers carpet the meadows.');
  }

  _evFire() {
    const sx = Math.floor(Math.random()*this.width);
    const sy = Math.floor(Math.random()*this.height);
    const spread = (x, y, depth) => {
      if (depth < 0 || !this._valid(x,y)) return;
      if (['TREE','GRASS','FLOWER','MUSHROOM'].includes(this.grid[y][x].type)) {
        this.setTile(x, y, 'FIRE');
        const t = setTimeout(() => {
          if (depth > 1) {
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dx,dy]) => spread(x+dx, y+dy, depth-1));
          }
        }, 2000 + Math.random()*3000);
        const bt = setTimeout(() => { if (this.getTile(x,y)?.type==='FIRE') this.setTile(x,y,'GRASS'); }, 12000);
        this._fireTimers.push(t, bt);
      }
    };
    spread(sx, sy, 3);
    this._log('🔥 Wildfire breaks out! Flames spread through the land!');
  }

  _evDrought() {
    for (let y=0;y<this.height;y++) for (let x=0;x<this.width;x++) {
      if (this.grid[y][x].type === 'WATER' && Math.random() < 0.25) this.setTile(x,y,'SAND');
      if (this.grid[y][x].type === 'FLOWER' && Math.random() < 0.3) this.setTile(x,y,'GRASS');
    }
    this.weather = 'dry';
    this._log('☀  Drought! Water evaporates, flowers wilt.');
    setTimeout(() => { this.weather = 'clear'; }, 22000);
  }

  _evSnowfall() {
    const n = 10 + Math.floor(Math.random() * 12);
    for (let i=0;i<n;i++) {
      const x = Math.floor(Math.random()*this.width);
      const y = Math.floor(Math.random()*this.height);
      const t = this.grid[y][x].type;
      if (['GRASS','FLOWER','SAND','RUINS'].includes(t)) this.setTile(x,y,'SNOW');
      else if (t === 'WATER') this.setTile(x,y,'ICE');
    }
    this.weather = 'snowing';
    this._log('❄  Snow falls! The land turns white and cold.');
    setTimeout(() => { this.weather = 'clear'; }, 28000);
  }

  _evEarthquake() {
    const n = 4 + Math.floor(Math.random() * 6);
    for (let i=0;i<n;i++) {
      const x = Math.floor(Math.random()*this.width);
      const y = Math.floor(Math.random()*this.height);
      if (['GRASS','PATH','FLOWER'].includes(this.grid[y][x].type)) this.setTile(x,y,'ROCK');
    }
    this._log('💥 Earthquake! Boulders erupt from the ground!');
  }

  _evMeteor() {
    const x = 1 + Math.floor(Math.random()*(this.width-2));
    const y = 1 + Math.floor(Math.random()*(this.height-2));
    this.setTile(x, y, 'FIRE');
    [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dx,dy]) => this.setTile(x+dx,y+dy,'ROCK'));
    this._log(`☄  A meteor strikes at (${x},${y})! Devastation!`);
    setTimeout(() => { if (this.getTile(x,y)?.type==='FIRE') this.setTile(x,y,'RUINS'); }, 8000);
  }

  _evMushrooms() {
    const n = 5 + Math.floor(Math.random()*6);
    for (let i=0;i<n;i++) {
      const x = Math.floor(Math.random()*this.width);
      const y = Math.floor(Math.random()*this.height);
      if (['GRASS','FOREST','FLOWER'].includes(this.grid[y][x].type)) this.setTile(x,y,'MUSHROOM');
    }
    this._log('🍄 Strange mushrooms sprout overnight across the land.');
  }

  _evSpring() {
    for (let y=0;y<this.height;y++) for (let x=0;x<this.width;x++) {
      const t = this.grid[y][x].type;
      if (t === 'SNOW')  this.setTile(x,y,'GRASS');
      if (t === 'ICE')   this.setTile(x,y,'WATER');
      if (t === 'FIRE')  this.setTile(x,y,'GRASS');
    }
    this.weather = 'clear';
    this._log('🌤  Thaw! Spring warmth melts ice and extinguishes fires.');
  }

  _log(msg) {
    this.eventLog.unshift({ msg, time: Date.now() });
    if (this.eventLog.length > 30) this.eventLog.pop();
  }

  // ── World Description for LLM ────────────────────────────────────────────
  describe(cx, cy, radius = 3) {
    const lines = [];
    lines.push(`Weather: ${this.weather}`);
    lines.push(`Your position: (${cx}, ${cy})`);
    lines.push('');
    lines.push('Surroundings (radius 3):');

    // North/South/East/West immediate neighbors described clearly
    const dirs = [
      [0,-1,'North'], [0,1,'South'], [1,0,'East'], [-1,0,'West'],
      [1,-1,'NE'],    [-1,-1,'NW'],  [1,1,'SE'],   [-1,1,'SW'],
    ];
    dirs.forEach(([dx,dy,name]) => {
      const t = this.getTile(cx+dx, cy+dy);
      if (t) lines.push(`  ${name}: ${TILE[t.type]?.desc ?? t.type}`);
    });

    // Extended area summary
    const nearby = {};
    for (let dy=-radius; dy<=radius; dy++) for (let dx=-radius; dx<=radius; dx++) {
      if (Math.abs(dx)<=1 && Math.abs(dy)<=1) continue;
      const t = this.getTile(cx+dx, cy+dy);
      if (t) nearby[t.type] = (nearby[t.type]||0)+1;
    }
    if (Object.keys(nearby).length) {
      lines.push('');
      lines.push('Nearby area contains: ' +
        Object.entries(nearby).map(([k,v])=>`${v}x ${TILE[k]?.desc??k}`).join(', '));
    }

    if (this.eventLog.length) {
      lines.push('');
      lines.push('Recent world events:');
      this.eventLog.slice(0,3).forEach(e => lines.push(`  - ${e.msg}`));
    }

    return lines.join('\n');
  }
}
