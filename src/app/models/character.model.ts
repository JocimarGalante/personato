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

export type SpecialAbilityId =
  | 'meteor' | 'blackhole' | 'timeFreeze' | 'healBurst'
  | 'thunderstorm' | 'nuke' | 'clone' | 'berserk';

export interface SpecialAbility {
  id: SpecialAbilityId;
  name: string;
  description: string;
  icon: string;
  cooldown: number;
  price: number;
}

export type RareItemId =
  | 'vampirism' | 'overcharge' | 'warpSpeed' | 'magnet'
  | 'guardian' | 'ghost' | 'duplicator' | 'executioner';

export interface RareItem {
  id: RareItemId;
  name: string;
  description: string;
  icon: string;
  price: number;
  oneTime: boolean;
}

// ─── NOVO: Itens Lendários comprados com diamantes ───
export type LegendaryItemId =
  | 'diamondMagnet'    // Puxa todos os pickups
  | 'perfectAim'       // 100% crítico
  | 'infiniteEnergy'   // Sem cooldowns de habilidades
  | 'soulHarvest'      // +50% materiais
  | 'divineShield'     // Revive 1x por partida
  | 'phoenixFeather'   // Regen 2% HP/s
  | 'deathRay'         // +1 arma (7º slot)
  | 'timeLord'         // +5s em cada onda
  | 'elementalMaster'  // Armas aplicam queimadura + lentidão
  | 'treasureHunter';  // Goblins aparecem 3x mais

export interface LegendaryItem {
  id: LegendaryItemId;
  name: string;
  description: string;
  icon: string;
  price: number;        // em diamantes
  oneTime: boolean;
}

// ─── NOVO: Upgrades comprados com R$ ───
export type UpgradeId =
  | 'maxHp' | 'armor' | 'speed' | 'damage'
  | 'attackSpeed' | 'harvesting' | 'critChance';

export interface Upgrade {
  id: UpgradeId;
  name: string;
  description: string;
  icon: string;
  basePrice: number;      // R$ custo inicial
  priceScale: number;     // multiplicador por nível
  maxLevel: number;
  effectPerLevel: number; // quanto cada nível dá
  unit: string;           // '+X HP', '+Y%', etc
}

// ─── NOVO: estado dos upgrades ───
export interface UpgradeLevels {
  maxHp: number;
  armor: number;
  speed: number;
  damage: number;
  attackSpeed: number;
  harvesting: number;
  critChance: number;
}

export type EnemyType =
  | 'normal' | 'fast' | 'tank'
  | 'goblin'
  | 'boss_goblin' | 'boss_reaper' | 'boss_titan';

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
  frozenUntil?: number;
  isBoss?: boolean;
  bossName?: string;
  moneyDrop?: number;
  materialDrop?: number;
  diamondDrop?: number;    // NOVO: drop de diamante
  abilityTimer?: number;
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

export interface MoneyPickup {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  lifetime: number;
}

// ─── NOVO: pickup de diamante ───
export interface DiamondPickup {
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
  | 'money' | 'bossAura' | 'diamond';

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
  isMoney?: boolean;
  isDiamond?: boolean;
}

export interface AbilityCooldowns {
  [abilityId: string]: number;
}

export type GameStatus =
  | 'menu' | 'playing' | 'paused' | 'shop'
  | 'blackMarket' | 'legendaryShop' | 'replaceWeapon' | 'gameover';

export interface GameState {
  status: GameStatus;
  wave: number;
  timeLeft: number;
  waveDuration: number;
  materials: number;
  money: number;
  diamonds: number;              // NOVO: diamantes
  playerHp: number;
  playerMaxHp: number;
  kills: number;
  damageDealt: number;
  autoAim: boolean;
  abilityCooldowns: AbilityCooldowns;
  specialAbilityId: SpecialAbilityId | null;
  specialAbilityCooldown: number;
  ownedRareItems: RareItemId[];
  ownedLegendaryItems: LegendaryItemId[];  // NOVO
  upgrades: UpgradeLevels;                 // NOVO
  hasRevive: boolean;                      // NOVO: revive do Anjo
  screenShake: number;
  pausedFrom?: 'playing' | 'shop' | 'blackMarket' | 'legendaryShop' | 'replaceWeapon';
  bossActive: boolean;
  bossName?: string;
  // NOVO: controle de substituição de arma
  pendingWeapon?: Weapon;
  pendingWeaponPrice?: number;
}
