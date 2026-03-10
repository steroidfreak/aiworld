const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-haiku-4-5-20251001';

export class LLMEngine {
  constructor() {
    this.apiKey = localStorage.getItem('aiworld_apikey') || '';
  }

  setApiKey(key) {
    this.apiKey = key.trim();
    localStorage.setItem('aiworld_apikey', this.apiKey);
  }

  // Main thinking function — returns { thought, speech, action }
  async think(character, worldDescription, nearbyCharacters) {
    if (!this.apiKey) {
      return this._fallback(character);
    }

    const othersDesc = nearbyCharacters.length
      ? 'Nearby characters: ' + nearbyCharacters.map(c =>
          `${c.name} at (${c.x},${c.y})${c.bubble ? ` — saying "${c.bubble.text}"` : ''}`
        ).join('; ')
      : 'You are alone in this area.';

    const prompt = [
      `You are ${character.name}.`,
      '',
      `CHARACTER PROFILE:`,
      character.profile,
      '',
      `WORLD STATE:`,
      worldDescription,
      '',
      othersDesc,
      '',
      `YOUR RECENT HISTORY:`,
      character.historyText(),
      '',
      `SIM LIFE STATE:`,
      `Mood: ${character.mood}`,
      `Current activity: ${character.activity}`,
      `Aspiration: ${character.aspiration}`,
      `Needs (0-100): ${Object.entries(character.needs).map(([k,v]) => `${k}:${Math.round(v)}`).join(', ')}`,
      '',
      `INSTRUCTIONS:`,
      `Decide what ${character.name} does next as an autonomous life sim agent. Consider terrain, social context, and needs.`,
      `Prioritize whichever need is currently low while still acting in character.`,
      `Invent a tiny slice-of-life action each turn (chatting, resting, exploring, daydreaming, etc.).`,
      `Stay in character. Be vivid but concise.`,
      '',
      `Respond ONLY with valid JSON in exactly this format:`,
      `{`,
      `  "thought": "your private inner monologue (1-2 sentences, in first person)",`,
      `  "speech":  "what you say aloud — or empty string if silent",`,
      `  "mood": "short mood label such as inspired/calm/stressed/playful",`,
      `  "activity": "what you are currently doing in <= 6 words",`,
      `  "needs": { "energy": 0-100, "hunger": 0-100, "social": 0-100, "fun": 0-100, "comfort": 0-100 },`,
      `  "action":  { "type": "MOVE", "direction": "north|south|east|west|stay" }`,
      `}`,
    ].join('\n');

    try {
      const res = await fetch(API_URL, {
        method : 'POST',
        headers: {
          'Content-Type'                        : 'application/json',
          'x-api-key'                           : this.apiKey,
          'anthropic-version'                   : '2023-06-01',
          'anthropic-dangerous-direct-browser-calls': 'true',
        },
        body: JSON.stringify({
          model     : MODEL,
          max_tokens: 300,
          system    : character.systemPrompt,
          messages  : [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error('[LLM] API error:', res.status, txt);
        return this._fallback(character);
      }

      const data   = await res.json();
      const rawText = data.content?.[0]?.text ?? '';
      return this._parse(rawText, character);

    } catch (err) {
      console.error('[LLM] fetch error:', err);
      return this._fallback(character);
    }
  }

  _parse(text, character) {
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) throw new Error('No JSON found');
      const obj = JSON.parse(text.slice(start, end + 1));

      // Validate fields
      const thought   = typeof obj.thought === 'string'  ? obj.thought   : '...';
      const speech    = typeof obj.speech  === 'string'  ? obj.speech    : '';
      const mood      = typeof obj.mood === 'string' ? obj.mood : character.mood;
      const activity  = typeof obj.activity === 'string' ? obj.activity : character.activity;
      const direction = ['north','south','east','west','stay'].includes(obj.action?.direction)
        ? obj.action.direction : 'stay';

      return { thought, speech, mood, activity, needs: obj.needs, action: { type: 'MOVE', direction } };
    } catch(e) {
      console.warn('[LLM] parse failed:', e, '\nRaw:', text);
      return this._fallback(character);
    }
  }

  _fallback(character) {
    const dirs = ['north','south','east','west','stay'];
    const direction = dirs[Math.floor(Math.random() * dirs.length)];
    const thoughts  = [
      'I feel the wind and follow it...',
      'Perhaps I should wander a little further.',
      'Something draws me in this direction.',
      'I sense a change in the air.',
    ];
    return {
      thought : thoughts[Math.floor(Math.random() * thoughts.length)],
      speech  : '',
      mood    : ['calm', 'curious', 'sleepy', 'playful'][Math.floor(Math.random() * 4)],
      activity: ['wandering', 'people watching', 'taking a break', 'looking around'][Math.floor(Math.random() * 4)],
      needs   : {
        energy: 30 + Math.floor(Math.random() * 60),
        hunger: 25 + Math.floor(Math.random() * 70),
        social: 20 + Math.floor(Math.random() * 70),
        fun: 20 + Math.floor(Math.random() * 70),
        comfort: 20 + Math.floor(Math.random() * 70),
      },
      action  : { type: 'MOVE', direction },
    };
  }
}
