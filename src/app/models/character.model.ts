export interface CharacterStats {
  maxHp: number;
  speed: number;
  damageMultiplier: number;
  meleeBonus: number;
  rangedBonus: number;
  attackSpeed: number;
  harvesting: number;
  luck: number;
  armor: number;
  dodge: number;
  critChance: number;
  critMultiplier: number;
  lifesteal: number;
  range: number;
}

export type WeaponBehavior =
  | 'single' | 'spread' | 'pierce' | 'explosive'
  | 'chain' | 'beam' | 'melee' | 'boomerang';

export interface Weapon {
  id: string;
  name: string;
  type: 'melee' | 'ranged';
  behavior: WeaponBehavior;
  damage: number;
  range: number;
  cooldown: number;
  projectileSpeed?: number;
  color: string;
  icon: string;
  pierce?: number;
  projectiles?: number;
  spread?: number;
  explosionRadius?: number;
  chainCount?: number;
  chainRange?: number;
}

export type AbilityTrigger = 'passive' | 'active';

export interface Ability {
  id: string;
  name: string;
  description: string;
  icon: string;
  trigger: AbilityTrigger;
  cooldown?: number;
  key?: string;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  color: string;
  accentColor: string;
  emoji: string;
  stats: CharacterStats;
  startingWeapons: Weapon[];
  abilities: Ability[];
  lore: string;
}

// ─── NOVO: habilidade especial (slot E) comprável ───
export type SpecialAbilityId =
  | 'meteor'       // Chuva de meteoros
  | 'blackhole'    // Buraco negro que puxa inimigos
  | 'timeFreeze'   // Congela todos os inimigos
  | 'healBurst'    // Cura total + invulnerabilidade
  | 'thunderstorm' // Raio em cada inimigo
  | 'nuke'         // Explosão massiva em toda tela
  | 'clone'        // Invoca 2 clones que atiram
  | 'berserk';     // +200% dano e cadência por 8s

export interface SpecialAbility {
  id: SpecialAbilityId;
  name: string;
  description: string;
  icon: string;
  cooldown: number;
  price: number;   // em R$
}

// ─── NOVO: item raro comprável ───
export type RareItemId =
  | 'vampirism'    // +5 lifesteal permanente
  | 'overcharge'   // +50% dano global
  | 'warpSpeed'    // +40% velocidade
  | 'magnet'       // Puxa materiais e R$ próximos
  | 'guardian'     // +5 armadura
  | 'ghost'        // +25% esquiva
  | 'duplicator'   // +1 projétil em todas as armas
  | 'executioner'; // Inimigos abaixo de 15% HP morrem instantâneo

export interface RareItem {
  id: RareItemId;
  name: string;
  description: string;
  icon: string;
  price: number;
  oneTime: boolean; // só pode comprar uma vez
}

// ─── NOVO: inimigo Goblin e Boss ───
export type EnemyType =
  | 'normal' | 'fast' | 'tank'
  | 'goblin'         // dropa R$
  | 'boss_goblin'    // boss 10/20/30...
  | 'boss_reaper'    // boss
  | 'boss_titan';    // boss

export interface Enemy {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  color: string;
  type: EnemyType;
  burnTicks?: number;
  burnDamage?: number;
  slowUntil?: number;
  frozenUntil?: number;   // NOVO: congelamento
  isBoss?: boolean;       // NOVO
  bossName?: string;      // NOVO
  moneyDrop?: number;     // NOVO: R$ ao morrer
  materialDrop?: number;  // NOVO
  abilityTimer?: number;  // NOVO: timer para boss usar habilidades
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  color: string;
  fromPlayer: boolean;
  lifetime: number;
  pierce: number;
  hitIds: number[];
  behavior: WeaponBehavior;
  explosiveRadius?: number;
  chainCount?: number;
  chainRange?: number;
  bouncesLeft?: number;
  boomerangReturning?: boolean;
  originX?: number;
  originY?: number;
  isCrit: boolean;
  trailColor?: string;
  damageType?: 'fire' | 'ice' | 'lightning' | 'normal';
}

// ─── NOVO: pickup de dinheiro ───
export interface MoneyPickup {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  lifetime: number;
}

export type ParticleKind =
  | 'spark' | 'smoke' | 'explosion' | 'heal'
  | 'ring' | 'lightning' | 'fire' | 'ice'
  | 'money' | 'bossAura';

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  kind: ParticleKind;
  targetX?: number;
  targetY?: number;
}

export interface DamageText {
  id: number;
  x: number;
  y: number;
  value: number;
  color: string;
  lifetime: number;
  vy: number;
  isCrit: boolean;
  isMoney?: boolean;   // NOVO
}

export interface AbilityCooldowns {
  [abilityId: string]: number;
}

export type GameStatus =
  | 'menu' | 'playing' | 'paused' | 'shop' | 'blackMarket' | 'gameover';

export interface GameState {
  status: GameStatus;
  wave: number;
  timeLeft: number;
  waveDuration: number;
  materials: number;
  money: number;                // NOVO: R$
  playerHp: number;
  playerMaxHp: number;
  kills: number;
  damageDealt: number;
  autoAim: boolean;
  abilityCooldowns: AbilityCooldowns;
  specialAbilityId: SpecialAbilityId | null;  // NOVO
  specialAbilityCooldown: number;              // NOVO
  ownedRareItems: RareItemId[];                // NOVO
  screenShake: number;
  pausedFrom?: 'playing' | 'shop' | 'blackMarket';
  bossActive: boolean;          // NOVO
  bossName?: string;            // NOVO
}
