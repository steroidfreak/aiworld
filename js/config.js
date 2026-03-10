export const CONFIG = {
  WORLD_WIDTH: 20,
  WORLD_HEIGHT: 20,
  TILE_SIZE: 32,
  THINK_INTERVAL: 35000,       // faster life-sim cadence
  WORLD_EVENT_INTERVAL: 25000, // world changes every 25s
  BUBBLE_DURATION: 28000,      // bubble stays for 28s
  MAX_HISTORY: 6,
  FPS: 30,
  MOVE_SPEED: 4,               // pixels per frame when animating
};

export const TILE = {
  GRASS:    { id:'GRASS',    color:'#4A7C3F', accent:'#3A6430', walk:true,  desc:'grassy meadow'    },
  WATER:    { id:'WATER',    color:'#2255BB', accent:'#4488EE', walk:false, desc:'deep water'       },
  TREE:     { id:'TREE',     color:'#1E4A14', accent:'#2D6B1E', walk:false, desc:'dense forest'     },
  ROCK:     { id:'ROCK',     color:'#6B6B6B', accent:'#4A4A4A', walk:false, desc:'rocky ground'     },
  PATH:     { id:'PATH',     color:'#B89A68', accent:'#9A7D50', walk:true,  desc:'dirt path'        },
  HOUSE:    { id:'HOUSE',    color:'#8B4513', accent:'#CC3311', walk:false, desc:'a cottage'        },
  MOUNTAIN: { id:'MOUNTAIN', color:'#5A6878', accent:'#E8ECEE', walk:false, desc:'mountain peak'    },
  FLOWER:   { id:'FLOWER',   color:'#4A7C3F', accent:'#FFCC00', walk:true,  desc:'flower meadow'    },
  SAND:     { id:'SAND',     color:'#D4B483', accent:'#BFA070', walk:true,  desc:'sandy ground'     },
  FIRE:     { id:'FIRE',     color:'#CC2200', accent:'#FF8800', walk:true,  desc:'burning ground'   },
  SNOW:     { id:'SNOW',     color:'#D8E8F0', accent:'#AABBCC', walk:true,  desc:'snow-covered land'},
  ICE:      { id:'ICE',      color:'#88BBDD', accent:'#AACCEE', walk:true,  desc:'frozen surface'   },
  RUINS:    { id:'RUINS',    color:'#887766', accent:'#554433', walk:true,  desc:'ancient ruins'    },
  MUSHROOM: { id:'MUSHROOM', color:'#4A7C3F', accent:'#CC4444', walk:true,  desc:'mushroom grove'   },
};

export const DEFAULT_CHARACTERS = [
  {
    name: 'Aria',
    color: '#E74C3C',
    bodyColor: '#C0392B',
    profile: 'A curious wandering wizard who loves exploring and collecting magical artifacts.',
    systemPrompt: `You are Aria, a curious wandering wizard in a living 2D world. You love exploring, studying nature, and seeking magical phenomena. You speak in a thoughtful, slightly mystical way. Your goal is to explore every corner of this world and document your findings. You react emotionally to world events — storms excite you, fires worry you, flowers delight you.`,
    startX: 5,
    startY: 5,
  },
  {
    name: 'Brom',
    color: '#3498DB',
    bodyColor: '#2980B9',
    profile: 'A gruff but kind-hearted blacksmith who prefers to stay near settlements and paths.',
    systemPrompt: `You are Brom, a gruff but warm-hearted blacksmith in a living 2D world. You prefer paths and settlements over wilderness. You speak in short, direct sentences with occasional grumbles. Your goal is to keep to well-trodden paths, find other people, and trade stories. You distrust forests and deep water. You value safety and comfort.`,
    startX: 14,
    startY: 10,
  },
];
