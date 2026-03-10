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
      `INSTRUCTIONS:`,
      `Decide what ${character.name} does next. Consider the terrain, events, and surroundings.`,
      `Stay in character. Be vivid but concise.`,
      '',
      `Respond ONLY with valid JSON in exactly this format:`,
      `{`,
      `  "thought": "your private inner monologue (1-2 sentences, in first person)",`,
      `  "speech":  "what you say aloud — or empty string if silent",`,
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
      // Extract first JSON object from response
      const m = text.match(/\{[\s\S]*?\}/);
      if (!m) throw new Error('No JSON found');
      const obj = JSON.parse(m[0]);

      // Validate fields
      const thought   = typeof obj.thought === 'string'  ? obj.thought   : '...';
      const speech    = typeof obj.speech  === 'string'  ? obj.speech    : '';
      const direction = ['north','south','east','west','stay'].includes(obj.action?.direction)
        ? obj.action.direction : 'stay';

      return { thought, speech, action: { type: 'MOVE', direction } };
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
      action  : { type: 'MOVE', direction },
    };
  }
}
