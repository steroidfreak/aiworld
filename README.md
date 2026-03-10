# ⚔ AI World — LLM Character Simulator

A 2D tile-based world where characters are played autonomously by Claude AI. Set a system prompt and character profile, then watch them think, speak, and explore on their own.

![AI World](https://img.shields.io/badge/Claude-Haiku-orange) ![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-yellow) ![No Build](https://img.shields.io/badge/No%20Build%20Step-green)

---

## How it works

- The world is a **20×20 tile grid** that changes dynamically — storms flood fields, wildfires spread through forests, meteors strike, snow falls
- Each character calls the **Claude API (Haiku)** every 60 seconds to decide what to do
- Characters see their surroundings, the current weather, nearby characters, and recent events, then return a JSON action: `{ thought, speech, direction }`
- **Thought bubbles** (dashed) show their inner monologue; **speech bubbles** (solid) show what they say aloud
- Everything runs in the browser — no backend, no database, no build step

---

## Requirements

- [Node.js](https://nodejs.org) v18+ (only for the local dev server)
- An [Anthropic API key](https://console.anthropic.com/) with access to `claude-haiku-4-5-20251001`

---

## Quick Start (Local)

```bash
# 1. Clone or download the project
git clone <your-repo-url>
cd aiworld

# 2. Start the dev server
node serve.js

# 3. Open in browser
# → http://localhost:3000
```

Then paste your Anthropic API key into the field in the top-right sidebar and click **Save**. Characters will start thinking within 5–15 seconds.

> **Why a server?** The game uses ES modules (`import/export`), which browsers block when opening `index.html` directly from disk (`file://`). Any static file server works — the included `serve.js` is the simplest option.

---

## Alternative: Deploy as a Static Site

The game is pure HTML/CSS/JS with no build step. You can host it anywhere that serves static files.

### Netlify / Vercel (drag and drop)

1. Zip the project folder (excluding `.git/`)
2. Go to [netlify.com](https://netlify.com) → drag the zip onto the deploy area
3. Done — you get a public URL instantly

Or with the CLI:

```bash
# Netlify
npx netlify-cli deploy --prod --dir .

# Vercel
npx vercel --prod
```

### GitHub Pages

```bash
# Push to a GitHub repo, then enable Pages in Settings → Pages
# Set source to: Deploy from branch → main → / (root)
git add .
git commit -m "initial commit"
git push origin main
```

Then go to `Settings → Pages` in your repo and set the source to the `main` branch root. Your site will be live at `https://<username>.github.io/<repo-name>`.

### Any Static Host (nginx, Apache, Caddy, etc.)

Just copy all files to your web root. The only requirement is that `.js` files are served with the `application/javascript` content-type, which all standard servers do by default.

```bash
# Example: copy to nginx web root
cp -r . /var/www/html/aiworld/
```

---

## Project Structure

```
aiworld/
├── index.html          # Main UI — canvas + sidebar
├── style.css           # Retro RPG dark theme (Press Start 2P font)
├── serve.js            # Minimal Node.js dev server (no npm install needed)
└── js/
    ├── config.js       # Tile definitions, default characters, timing constants
    ├── world.js        # World engine — terrain generation + random events
    ├── character.js    # Character class — position, animation, bubbles, memory
    ├── llm.js          # Claude API integration — builds prompts, parses responses
    ├── renderer.js     # Canvas rendering — tiles, sprites, speech bubbles
    └── main.js         # Game loop, UI bindings, character scheduling
```

---

## Adding Characters

### In the browser

Click **➕ Add Character** in the sidebar and fill in:

| Field | Description |
|---|---|
| Name | The character's name (shown on screen) |
| Color | Pick a color for their outfit |
| Profile | Short description shown in the sidebar |
| System Prompt | The LLM personality — how they think, speak, and behave |

### In code (`js/config.js`)

Add an entry to `DEFAULT_CHARACTERS`:

```js
{
  name:         'Mira',
  color:        '#27AE60',       // outfit color
  bodyColor:    '#1E8449',       // pants / darker shade
  profile:      'A cheerful herbalist who collects rare plants.',
  systemPrompt: `You are Mira, a cheerful herbalist exploring a living 2D world.
You love finding rare plants and mushrooms. You speak warmly and curiously.
You gravitate toward flower meadows and forests. Storms make you nervous.`,
  startX: 8,
  startY: 12,
}
```

---

## Tuning Behavior

All timing is in `js/config.js`:

```js
THINK_INTERVAL:        60000,  // how often each character calls the LLM (ms)
WORLD_EVENT_INTERVAL:  25000,  // base interval between world events (ms)
BUBBLE_DURATION:       28000,  // how long thought/speech bubbles stay visible (ms)
```

---

## Adding World Events

In `js/world.js`, add a new method:

```js
_evYourEvent() {
  // modify this.grid tiles as needed
  this.setTile(x, y, 'FIRE'); // or any TILE type from config.js
  this._log('📣 Description of what happened.');
}
```

Then register it in `triggerRandomEvent()`:

```js
const events = [
  this._evStorm, this._evBloom, /* ... */ this._evYourEvent,
];
```

---

## Adding Tile Types

1. Add to `TILE` in `js/config.js`:
```js
SWAMP: { id:'SWAMP', color:'#3D5A2A', accent:'#2A3D1E', walk:true, desc:'murky swamp' },
```

2. Add a draw function in `js/renderer.js`:
```js
case 'SWAMP': this._tileSwamp(ctx, px, py); break;

_tileSwamp(ctx, px, py) {
  // draw using ctx — tile is 32×32px, origin at (px, py)
}
```

---

## API Key Security

The API key is stored in `localStorage` in the browser and sent directly to the Anthropic API. This is fine for personal use but **do not deploy this publicly with a shared API key** — anyone visiting the page could read it from localStorage.

For a public deployment, add a thin backend proxy that holds the key server-side and rate-limits requests per user.

---

## Controls

| Button | Action |
|---|---|
| **Save** | Save API key to localStorage |
| **⚡ World Event** | Trigger a random world event immediately |
| **🧠 Think Now** | Force all characters to think right now |
| **➕ Add Character** | Open the add character dialog |
| **✕** on a card | Remove that character from the world |
