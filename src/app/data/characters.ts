import type {
  Character, Weapon, SpecialAbility, RareItem,
  LegendaryItem, Upgrade
} from '../models/character.model';

// ═══════════════════════════════════════════════════════════
// ARMAS
// ═══════════════════════════════════════════════════════════

export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'Pistola', type: 'ranged',
    behavior: 'single',
    damage: 8, range: 260, cooldown: 400,
    projectileSpeed: 550, color: '#ffd700', icon: '🔫'
  },
  knife: {
    id: 'knife', name: 'Faca', type: 'melee',
    behavior: 'melee',
    damage: 12, range: 55, cooldown: 300,
    color: '#c0c0c0', icon: '🔪'
  },
  shotgun: {
    id: 'shotgun', name: 'Escopeta', type: 'ranged',
    behavior: 'spread',
    damage: 9, range: 170, cooldown: 850,
    projectileSpeed: 480, color: '#ff6b35', icon: '🔫',
    projectiles: 4, spread: 0.45
  },
  stick: {
    id: 'stick', name: 'Cajado', type: 'melee',
    behavior: 'melee',
    damage: 15, range: 65, cooldown: 450,
    color: '#8b4513', icon: '🪵'
  },
  smg: {
    id: 'smg', name: 'SMG', type: 'ranged',
    behavior: 'single',
    damage: 5, range: 230, cooldown: 130,
    projectileSpeed: 650, color: '#e74c3c', icon: '🔫'
  },
  fists: {
    id: 'fists', name: 'Punhos', type: 'melee',
    behavior: 'melee',
    damage: 10, range: 42, cooldown: 240,
    color: '#e67e22', icon: '👊'
  },
  laser: {
    id: 'laser', name: 'Laser Perfurante', type: 'ranged',
    behavior: 'pierce',
    damage: 25, range: 380, cooldown: 620,
    projectileSpeed: 900, color: '#00ffff', icon: '⚡',
    pierce: 3
  },
  sniper: {
    id: 'sniper', name: 'Sniper', type: 'ranged',
    behavior: 'pierce',
    damage: 65, range: 650, cooldown: 1500,
    projectileSpeed: 1500, color: '#f1c40f', icon: '🎯',
    pierce: 6
  },
  grenadeLauncher: {
    id: 'grenadeLauncher', name: 'Lança-Granadas', type: 'ranged',
    behavior: 'explosive',
    damage: 30, range: 320, cooldown: 1100,
    projectileSpeed: 350, color: '#e67e22', icon: '💣',
    explosionRadius: 70
  },
  lightningGun: {
    id: 'lightningGun', name: 'Arma Trovão', type: 'ranged',
    behavior: 'chain',
    damage: 18, range: 300, cooldown: 700,
    projectileSpeed: 800, color: '#9b59b6', icon: '⚡',
    chainCount: 3, chainRange: 140
  },
  flamethrower: {
    id: 'flamethrower', name: 'Lança-Chamas', type: 'ranged',
    behavior: 'spread',
    damage: 4, range: 140, cooldown: 55,
    projectileSpeed: 320, color: '#ff4500', icon: '🔥',
    projectiles: 3, spread: 0.55
  },
  scythe: {
    id: 'scythe', name: 'Foice', type: 'melee',
    behavior: 'melee',
    damage: 22, range: 75, cooldown: 550,
    color: '#9b59b6', icon: '🌙'
  },
  boomerang: {
    id: 'boomerang', name: 'Bumerangue', type: 'ranged',
    behavior: 'boomerang',
    damage: 16, range: 320, cooldown: 900,
    projectileSpeed: 450, color: '#2ecc71', icon: '🪃'
  },
  magicWand: {
    id: 'magicWand', name: 'Varinha', type: 'ranged',
    behavior: 'single',
    damage: 12, range: 280, cooldown: 500,
    projectileSpeed: 500, color: '#ff69b4', icon: '🪄'
  }
} as const satisfies Record<string, Weapon>;

// ═══════════════════════════════════════════════════════════
// PERSONAGENS (vida reduzida para dificultar)
// ═══════════════════════════════════════════════════════════

const baseStats = {
  maxHp: 25, speed: 210, damageMultiplier: 1.0,
  meleeBonus: 0, rangedBonus: 0, attackSpeed: 1.0,
  harvesting: 3, luck: 0, armor: 0, dodge: 0,
  critChance: 0.05, critMultiplier: 2.0,
  lifesteal: 0, range: 1.0
};

export const CHARACTERS: Character[] = [
  {
    id: 'wellrounded',
    name: 'Equilibrado',
    description: 'Sem fraquezas. +10% crítico, +10% cadência. Começa com 30 HP.',
    color: '#4ecdc4',
    accentColor: '#2ecc71',
    emoji: '🥔',
    lore: 'Nasceu na horta, cresceu na guerra.',
    stats: {
      ...baseStats,
      maxHp: 30, speed: 220, harvesting: 5,
      critChance: 0.10, attackSpeed: 1.10
    },
    startingWeapons: [{ ...WEAPONS.pistol }, { ...WEAPONS.knife }],
    abilities: [
      { id: 'adaptive', name: 'Adaptável', icon: '⚖️', trigger: 'passive',
        description: '+10% crítico, +10% cadência.' },
      { id: 'focus', name: 'Foco', icon: '🎯', trigger: 'active', cooldown: 12, key: 'Q',
        description: 'Por 4s, +50% crítico e +50% cadência.' }
    ]
  },
  {
    id: 'brawler',
    name: 'Berserker',
    description: 'Fúria cresce ao tomar dano. +10 melee, 25% esquiva, cura 2 HP por acerto melee.',
    color: '#e74c3c',
    accentColor: '#ff0000',
    emoji: '🥊',
    lore: 'Cada cicatriz conta uma história de vitória.',
    stats: {
      ...baseStats,
      maxHp: 35, speed: 245, meleeBonus: 10, rangedBonus: -15,
      attackSpeed: 1.20, dodge: 0.25, lifesteal: 2,
      critChance: 0.15
    },
    startingWeapons: [{ ...WEAPONS.fists }, { ...WEAPONS.fists }],
    abilities: [
      { id: 'bloodthirst', name: 'Sede de Sangue', icon: '🩸', trigger: 'passive',
        description: 'Cura 2 HP por acerto melee.' },
      { id: 'rage', name: 'Fúria', icon: '😡', trigger: 'active', cooldown: 15, key: 'Q',
        description: 'Por 5s, +100% dano e +50% velocidade.' }
    ]
  },
  {
    id: 'gunner',
    name: 'Franco-Atirador',
    description: 'Dano à distância devastador. +15 ranged, +30% alcance, 25% crítico x2.5.',
    color: '#f39c12',
    accentColor: '#ff8c00',
    emoji: '🎯',
    lore: 'Uma bala, um abate.',
    stats: {
      ...baseStats,
      maxHp: 20, speed: 205, rangedBonus: 15, meleeBonus: -10,
      attackSpeed: 1.10, range: 1.30, critChance: 0.25, critMultiplier: 2.5
    },
    startingWeapons: [{ ...WEAPONS.pistol }, { ...WEAPONS.smg }],
    abilities: [
      { id: 'sniper_eye', name: 'Olho de Águia', icon: '🦅', trigger: 'passive',
        description: '+30% alcance, +25% crítico.' },
      { id: 'killshot', name: 'Tiro Letal', icon: '💥', trigger: 'active', cooldown: 10, key: 'Q',
        description: 'Próximo disparo: dano x5.' }
    ]
  },
  {
    id: 'speedy',
    name: 'Corredor',
    description: 'Mover aumenta dano. +45% velocidade. Ao mover: +40% dano, +20% esquiva.',
    color: '#2ecc71',
    accentColor: '#00ff88',
    emoji: '💨',
    lore: 'Nunca fica parado. Nunca.',
    stats: {
      ...baseStats,
      maxHp: 18, speed: 300, meleeBonus: 8,
      dodge: 0.05, critChance: 0.10
    },
    startingWeapons: [{ ...WEAPONS.knife }, { ...WEAPONS.stick }],
    abilities: [
      { id: 'momentum', name: 'Momento', icon: '⚡', trigger: 'passive',
        description: 'Movendo: +40% dano, +20% esquiva. Parado: -40% dano.' },
      { id: 'dash', name: 'Investida', icon: '💥', trigger: 'active', cooldown: 8, key: 'Q',
        description: 'Dash + explosão causando 40 de dano.' }
    ]
  },
  {
    id: 'tank',
    name: 'Colosso',
    description: '50 vida extra, +6 armadura, imune a knockback. Reflete 50% do dano recebido.',
    color: '#9b59b6',
    accentColor: '#8e44ad',
    emoji: '🛡️',
    lore: 'Montanhas se curvam ao seu passo.',
    stats: {
      ...baseStats,
      maxHp: 55, speed: 165, armor: 6,
      attackSpeed: 0.85, critChance: 0.15, meleeBonus: 5
    },
    startingWeapons: [{ ...WEAPONS.shotgun }, { ...WEAPONS.knife }],
    abilities: [
      { id: 'thorns', name: 'Espinhos', icon: '🌵', trigger: 'passive',
        description: 'Reflete 50% do dano recebido.' },
      { id: 'fortress', name: 'Fortaleza', icon: '🏰', trigger: 'active', cooldown: 20, key: 'Q',
        description: 'Por 5s, invulnerável.' }
    ]
  },
  {
    id: 'doctor',
    name: 'Médico de Combate',
    description: 'Armas com dano ≥ 20 disparam 3x. Regenera 1 HP/s. Lifesteal 1.',
    color: '#1abc9c',
    accentColor: '#16a085',
    emoji: '🩺',
    lore: 'Sua lista de pacientes cresce mais rápido que seus inimigos.',
    stats: {
      ...baseStats,
      maxHp: 25, speed: 200, harvesting: 3,
      attackSpeed: 0.7, lifesteal: 1
    },
    startingWeapons: [{ ...WEAPONS.laser }, { ...WEAPONS.scythe }],
    abilities: [
      { id: 'medical_weapons', name: 'Arsenal Médico', icon: '💉', trigger: 'passive',
        description: 'Armas ≥20 dano: cadência x3. Regenera 1 HP/s.' },
      { id: 'triage', name: 'Triagem', icon: '❤️', trigger: 'active', cooldown: 18, key: 'Q',
        description: 'Cura 50 HP e dobra lifesteal por 6s.' }
    ]
  },
  {
    id: 'mage',
    name: 'Arcanista',
    description: 'Cada arma equipada dá +8% dano global. Frágil mas poderoso.',
    color: '#ff69b4',
    accentColor: '#c39bd3',
    emoji: '🧙',
    lore: 'O poder não vem do aço, mas do conhecimento.',
    stats: {
      ...baseStats,
      maxHp: 18, speed: 210, rangedBonus: 6, meleeBonus: -12,
      attackSpeed: 1.0, range: 1.15, critChance: 0.08
    },
    startingWeapons: [{ ...WEAPONS.magicWand }, { ...WEAPONS.lightningGun }],
    abilities: [
      { id: 'arcane_boost', name: 'Amplificação', icon: '✨', trigger: 'passive',
        description: '+8% dano por arma equipada.' },
      { id: 'arcane_nova', name: 'Nova Arcana', icon: '💫', trigger: 'active', cooldown: 14, key: 'Q',
        description: 'Explosão em área + empurra inimigos.' }
    ]
  },
  {
    id: 'engineer',
    name: 'Engenheiro',
    description: 'Explosões +50% maiores e +30% dano. Armas de fogo rápido ganham bônus.',
    color: '#e67e22',
    accentColor: '#d35400',
    emoji: '🔧',
    lore: 'Se explodir, é porque funcionou.',
    stats: {
      ...baseStats,
      maxHp: 30, speed: 195, rangedBonus: 5,
      attackSpeed: 0.95, armor: 2, critChance: 0.10
    },
    startingWeapons: [{ ...WEAPONS.grenadeLauncher }, { ...WEAPONS.smg }],
    abilities: [
      { id: 'demolition', name: 'Demolição', icon: '💣', trigger: 'passive',
        description: 'Explosões +50% raio e +30% dano.' },
      { id: 'barrage', name: 'Barragem', icon: '🚀', trigger: 'active', cooldown: 25, key: 'Q',
        description: 'Explosão em cada inimigo na tela.' }
    ]
  }
];

// ═══════════════════════════════════════════════════════════
// HABILIDADES ESPECIAIS (slot E) — compradas com R$
// ═══════════════════════════════════════════════════════════

export const SPECIAL_ABILITIES: SpecialAbility[] = [
  {
    id: 'meteor',
    name: 'Chuva de Meteoros',
    description: 'Invoca 8 meteoros que caem causando dano em área.',
    icon: '☄️',
    cooldown: 20,
    price: 50
  },
  {
    id: 'blackhole',
    name: 'Buraco Negro',
    description: 'Cria um buraco negro que puxa e causa dano contínuo.',
    icon: '🕳️',
    cooldown: 25,
    price: 60
  },
  {
    id: 'timeFreeze',
    name: 'Congelar Tempo',
    description: 'Congela todos os inimigos por 5 segundos.',
    icon: '❄️',
    cooldown: 30,
    price: 70
  },
  {
    id: 'healBurst',
    name: 'Cura Divina',
    description: 'Cura total + invulnerabilidade por 3s.',
    icon: '✨',
    cooldown: 40,
    price: 80
  },
  {
    id: 'thunderstorm',
    name: 'Tempestade',
    description: 'Raios caem sobre todos os inimigos na tela.',
    icon: '⚡',
    cooldown: 22,
    price: 65
  },
  {
    id: 'nuke',
    name: 'Bomba Nuclear',
    description: 'Explosão massiva causando 300 de dano em toda tela.',
    icon: '💥',
    cooldown: 45,
    price: 100
  },
  {
    id: 'clone',
    name: 'Clones Espectrais',
    description: 'Invoca 2 clones que atiram automaticamente por 10s.',
    icon: '👥',
    cooldown: 35,
    price: 90
  },
  {
    id: 'berserk',
    name: 'Fúria Sangrenta',
    description: '+200% dano e cadência por 8s. Cura 20% do dano causado.',
    icon: '🔥',
    cooldown: 28,
    price: 75
  }
];

// ═══════════════════════════════════════════════════════════
// ITENS RAROS (loja negra) — efeitos permanentes
// ═══════════════════════════════════════════════════════════

export const RARE_ITEMS: RareItem[] = [
  {
    id: 'vampirism',
    name: 'Vampirismo',
    description: '+5 lifesteal permanente.',
    icon: '🩸',
    price: 40,
    oneTime: true
  },
  {
    id: 'overcharge',
    name: 'Sobrecarga',
    description: '+50% dano global permanente.',
    icon: '⚡',
    price: 60,
    oneTime: true
  },
  {
    id: 'warpSpeed',
    name: 'Velocidade Warp',
    description: '+40% velocidade de movimento.',
    icon: '🚀',
    price: 35,
    oneTime: true
  },
  {
    id: 'guardian',
    name: 'Anjo Guardião',
    description: '+5 armadura permanente.',
    icon: '🛡️',
    price: 45,
    oneTime: true
  },
  {
    id: 'ghost',
    name: 'Manto Fantasma',
    description: '+25% esquiva permanente.',
    icon: '👻',
    price: 55,
    oneTime: true
  },
  {
    id: 'duplicator',
    name: 'Duplicador',
    description: '+1 projétil em todas as armas.',
    icon: '🔀',
    price: 80,
    oneTime: true
  },
  {
    id: 'executioner',
    name: 'Execução',
    description: 'Inimigos abaixo de 15% HP morrem instantâneo.',
    icon: '⚔️',
    price: 70,
    oneTime: true
  },
  {
    id: 'magnet',
    name: 'Ímã Arcano',
    description: 'Atrai automaticamente materiais e R$ próximos.',
    icon: '🧲',
    price: 30,
    oneTime: true
  }
];

// ═══════════════════════════════════════════════════════════
// ITENS LENDÁRIOS (Diamantes 💠) — top de linha
// ═══════════════════════════════════════════════════════════

export const LEGENDARY_ITEMS: LegendaryItem[] = [
  {
    id: 'diamondMagnet',
    name: 'Ímã Diamante',
    description: 'Puxa TODOS os pickups da tela automaticamente.',
    icon: '💠',
    price: 15,
    oneTime: true
  },
  {
    id: 'perfectAim',
    name: 'Mira Perfeita',
    description: '100% chance de crítico em todos os ataques.',
    icon: '🎯',
    price: 25,
    oneTime: true
  },
  {
    id: 'infiniteEnergy',
    name: 'Energia Infinita',
    description: 'Habilidades Q e E SEM cooldown.',
    icon: '♾️',
    price: 30,
    oneTime: true
  },
  {
    id: 'soulHarvest',
    name: 'Colheita de Almas',
    description: '+100% materiais por inimigo.',
    icon: '💀',
    price: 20,
    oneTime: true
  },
  {
    id: 'divineShield',
    name: 'Escudo Divino',
    description: 'Revive automaticamente 1 vez ao morrer.',
    icon: '🛡️',
    price: 40,
    oneTime: true
  },
  {
    id: 'phoenixFeather',
    name: 'Pena de Fênix',
    description: 'Regenera 3% da vida máxima por segundo.',
    icon: '🔥',
    price: 35,
    oneTime: true
  },
  {
    id: 'deathRay',
    name: 'Raio da Morte',
    description: '+1 slot de arma (7 no total).',
    icon: '☠️',
    price: 50,
    oneTime: true
  },
  {
    id: 'timeLord',
    name: 'Senhor do Tempo',
    description: '+10 segundos em TODAS as ondas.',
    icon: '⏳',
    price: 30,
    oneTime: true
  },
  {
    id: 'elementalMaster',
    name: 'Mestre Elemental',
    description: 'Todas as armas causam queimadura + lentidão.',
    icon: '🌪️',
    price: 45,
    oneTime: true
  },
  {
    id: 'treasureHunter',
    name: 'Caçador de Tesouros',
    description: 'Goblins aparecem 3x mais. Drop de R$ dobrado.',
    icon: '💰',
    price: 25,
    oneTime: true
  }
];

// ═══════════════════════════════════════════════════════════
// UPGRADES (R$) — Custo aumenta a cada nível
// Fórmula: basePrice × priceScale ^ nível
// ═══════════════════════════════════════════════════════════

export const UPGRADES: Upgrade[] = [
  {
    id: 'maxHp',
    name: 'Vitalidade',
    description: 'Aumenta sua vida máxima.',
    icon: '❤️',
    basePrice: 8,
    priceScale: 1.5,
    maxLevel: 20,
    effectPerLevel: 5,
    unit: '+5 HP'
  },
  {
    id: 'armor',
    name: 'Blindagem',
    description: 'Reduz o dano recebido.',
    icon: '🛡️',
    basePrice: 12,
    priceScale: 1.6,
    maxLevel: 10,
    effectPerLevel: 1,
    unit: '+1 Armadura'
  },
  {
    id: 'speed',
    name: 'Agilidade',
    description: 'Move mais rápido.',
    icon: '👟',
    basePrice: 10,
    priceScale: 1.5,
    maxLevel: 15,
    effectPerLevel: 8,
    unit: '+8 Velocidade'
  },
  {
    id: 'damage',
    name: 'Força',
    description: 'Aumenta o dano de todas as armas.',
    icon: '⚔️',
    basePrice: 15,
    priceScale: 1.7,
    maxLevel: 15,
    effectPerLevel: 0.08,
    unit: '+8% Dano'
  },
  {
    id: 'attackSpeed',
    name: 'Fúria',
    description: 'Aumenta a cadência de ataque.',
    icon: '⚡',
    basePrice: 14,
    priceScale: 1.6,
    maxLevel: 12,
    effectPerLevel: 0.06,
    unit: '+6% Cadência'
  },
  {
    id: 'harvesting',
    name: 'Coleta',
    description: 'Ganha mais materiais por onda.',
    icon: '💎',
    basePrice: 10,
    priceScale: 1.4,
    maxLevel: 10,
    effectPerLevel: 2,
    unit: '+2 Mat/Onda'
  },
  {
    id: 'critChance',
    name: 'Precisão',
    description: 'Chance de acerto crítico.',
    icon: '🎯',
    basePrice: 18,
    priceScale: 1.7,
    maxLevel: 10,
    effectPerLevel: 0.04,
    unit: '+4% Crítico'
  }
];
