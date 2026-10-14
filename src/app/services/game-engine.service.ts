import { Injectable, signal, DestroyRef, inject } from '@angular/core';
import {
  Character, Enemy, Bullet, GameState, Weapon, CharacterStats,
  DamageText, Particle, ParticleKind,
  SpecialAbilityId, RareItemId, LegendaryItemId, UpgradeId,
  UpgradeLevels, MoneyPickup, DiamondPickup,
  RankingEntry, RunStats
} from '../models/character.model';
import {
  WEAPONS, SPECIAL_ABILITIES, RARE_ITEMS,
  LEGENDARY_ITEMS, UPGRADES
} from '../data/characters';
import { RankingService } from './ranking.service';

@Injectable({ providedIn: 'root' })
export class GameEngineService {
  private destroyRef = inject(DestroyRef);
  private rankingService = inject(RankingService);

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animationId?: number;
  private lastFrameTime = 0;
  private readonly FRAME_INTERVAL = 16.67;

  private static waveDuration(wave: number): number {
    return 10 + (wave - 1) * 5;
  }

  private readonly defaultUpgrades: UpgradeLevels = {
    maxHp: 0, armor: 0, speed: 0, damage: 0,
    attackSpeed: 0, harvesting: 0, critChance: 0
  };

  readonly state = signal<GameState>({
    status: 'menu',
    wave: 1,
    timeLeft: GameEngineService.waveDuration(1),
    waveDuration: GameEngineService.waveDuration(1),
    materials: 0, money: 0, diamonds: 0,
    playerHp: 30, playerMaxHp: 30,
    kills: 0, damageDealt: 0, autoAim: true,
    abilityCooldowns: {},
    specialAbilityId: null,
    specialAbilityCooldown: 0,
    ownedRareItems: [],
    ownedLegendaryItems: [],
    upgrades: { ...this.defaultUpgrades },
    hasRevive: false,
    screenShake: 0,
    bossActive: false
  });

  readonly selectedCharacter = signal<Character | null>(null);
  readonly availableWeapons = signal<Weapon[]>([]);
  readonly lastRunStats = signal<RunStats | null>(null);
  private runStartTime = 0;

  private playerX = 400;
  private playerY = 300;
  private playerStats!: CharacterStats;
  private baseStats!: CharacterStats;
  private currentWeapons: Weapon[] = [];
  private weaponCooldowns: number[] = [];
  private keys: Record<string, boolean> = {};
  private isMoving = false;
  private facingAngle = 0;
  private maxWeaponSlots = 5;

  private buffs = {
    critBoostUntil: 0, cadenceBoostUntil: 0, damageBoostUntil: 0,
    speedBoostUntil: 0, armorBoostUntil: 0, invulnerableUntil: 0,
    lifestealBoostUntil: 0, nextShotLethal: false, berserkUntil: 0
  };

  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private damageTexts: DamageText[] = [];
  private particles: Particle[] = [];
  private moneyPickups: MoneyPickup[] = [];
  private diamondPickups: DiamondPickup[] = [];
  private enemyIdCounter = 0;
  private bulletIdCounter = 0;
  private damageTextIdCounter = 0;
  private particleIdCounter = 0;
  private moneyIdCounter = 0;
  private diamondIdCounter = 0;

  private clones: { x: number; y: number; expiresAt: number; cooldown: number }[] = [];
  private bossState = { active: false, name: '', level: 0, abilityCooldown: 0 };

  readonly canvasWidth = 800;
  readonly canvasHeight = 600;

  // ═════════════════════════════════════════════════════════
  // CICLO DE VIDA
  // ═════════════════════════════════════════════════════════

  initCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      this.stopLoop();
    });

    this.drawMenuBackground();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) {
      e.preventDefault();
    }
    if (!this.keys[k]) this.onKeyPress(k);
    this.keys[k] = true;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.key.toLowerCase()] = false;
  };

  private onKeyPress(k: string): void {
    const s = this.state();
    if (k === 'escape' || k === 'p') {
      if (s.status === 'playing' || s.status === 'shop' ||
          s.status === 'blackMarket' || s.status === 'legendaryShop') {
        this.pauseGame();
      } else if (s.status === 'paused') {
        this.resumeGame();
      }
      return;
    }
    if (s.status !== 'playing') return;
    if (k === 'q') this.useActiveAbility('Q');
    if (k === 'e') this.useSpecialAbility();
  }

  toggleAutoAim(): void {
    const s = this.state();
    if (s.status !== 'playing') return;
    this.state.update(st => ({ ...st, autoAim: !st.autoAim }));
  }

  pauseGame(): void {
    const s = this.state();
    if (s.status !== 'playing' && s.status !== 'shop' &&
        s.status !== 'blackMarket' && s.status !== 'legendaryShop') return;
    this.stopLoop();
    this.state.update(st => ({
      ...st,
      status: 'paused',
      pausedFrom: st.status as any
    }));
  }

  resumeGame(): void {
    const s = this.state();
    if (s.status !== 'paused') return;
    const from = s.pausedFrom ?? 'playing';
    this.state.update(st => ({
      ...st,
      status: from,
      pausedFrom: undefined
    }));
    if (from === 'playing') this.startLoop();
  }

  quitToMenu(): void { this.restart(); }

  startGame(character: Character): void {
    this.selectedCharacter.set(character);
    this.runStartTime = performance.now();
    this.lastRunStats.set(null);

    this.baseStats = { ...character.stats };
    this.playerStats = { ...character.stats };
    this.currentWeapons = character.startingWeapons.map(w => ({ ...w }));
    this.weaponCooldowns = this.currentWeapons.map(() => 0);
    this.maxWeaponSlots = 5;

    this.playerX = this.canvasWidth / 2;
    this.playerY = this.canvasHeight / 2;
    this.facingAngle = 0;
    this.enemies = [];
    this.bullets = [];
    this.damageTexts = [];
    this.particles = [];
    this.moneyPickups = [];
    this.diamondPickups = [];
    this.clones = [];
    this.enemyIdCounter = 0;
    this.bulletIdCounter = 0;
    this.damageTextIdCounter = 0;
    this.particleIdCounter = 0;
    this.moneyIdCounter = 0;
    this.diamondIdCounter = 0;
    this.keys = {};
    this.isMoving = false;
    this.bossState = { active: false, name: '', level: 0, abilityCooldown: 0 };
    this.buffs = {
      critBoostUntil: 0, cadenceBoostUntil: 0, damageBoostUntil: 0,
      speedBoostUntil: 0, armorBoostUntil: 0, invulnerableUntil: 0,
      lifestealBoostUntil: 0, nextShotLethal: false, berserkUntil: 0
    };

    const cooldowns: Record<string, number> = {};
    for (const ab of character.abilities) {
      if (ab.trigger === 'active') cooldowns[ab.id] = 0;
    }

    const w1 = GameEngineService.waveDuration(1);
    this.state.set({
      status: 'playing',
      wave: 1, timeLeft: w1, waveDuration: w1,
      materials: 0, money: 0, diamonds: 0,
      playerHp: this.playerStats.maxHp,
      playerMaxHp: this.playerStats.maxHp,
      kills: 0, damageDealt: 0, autoAim: true,
      abilityCooldowns: cooldowns,
      specialAbilityId: null,
      specialAbilityCooldown: 0,
      ownedRareItems: [],
      ownedLegendaryItems: [],
      upgrades: { ...this.defaultUpgrades },
      hasRevive: false,
      screenShake: 0,
      bossActive: false
    });

    this.startLoop();
  }

  private startLoop(): void {
    if (this.animationId) return;
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame(this.loop);
  }

  private stopLoop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }
  }

  private loop = (currentTime: number): void => {
    this.animationId = requestAnimationFrame(this.loop);
    const deltaTime = currentTime - this.lastFrameTime;
    if (deltaTime < this.FRAME_INTERVAL) return;
    this.lastFrameTime = currentTime;
    const dt = Math.min(deltaTime, 50) / 1000;
    this.update(dt);
    this.render();
  };

  private update(dt: number): void {
    const s = this.state();
    if (s.status !== 'playing') return;

    const now = performance.now() / 1000;

    this.updateBuffsExpire(now);
    this.updatePlayer(dt);
    this.updateClones(dt, now);
    this.updateEnemies(dt, now);
    this.updateBullets(dt);
    this.updateWeapons(dt, now);
    this.updateSpawning(dt);
    this.updateMoneyPickups(dt);
    this.updateDiamondPickups(dt);
    this.updateTimer(dt);
    this.updateDamageTexts(dt);
    this.updateParticles(dt);
    this.updateAbilityCooldowns(dt);
    this.updateSpecialCooldown(dt);
    this.updateScreenShake(dt);
    this.applyRegen(dt);
    this.updateStatusEffects(dt);
    this.updateLegendaryEffects(dt);
  }

  private updateLegendaryEffects(dt: number): void {
    const items = this.state().ownedLegendaryItems;
    if (items.includes('phoenixFeather')) {
      const healAmount = this.state().playerMaxHp * 0.03 * dt;
      this.healPlayer(healAmount);
    }
  }

  private updateBuffsExpire(now: number): void {
    const b = this.buffs;
    if (b.damageBoostUntil > 0 && now > b.damageBoostUntil) b.damageBoostUntil = 0;
    if (b.speedBoostUntil > 0 && now > b.speedBoostUntil) b.speedBoostUntil = 0;
    if (b.critBoostUntil > 0 && now > b.critBoostUntil) b.critBoostUntil = 0;
    if (b.cadenceBoostUntil > 0 && now > b.cadenceBoostUntil) b.cadenceBoostUntil = 0;
    if (b.armorBoostUntil > 0 && now > b.armorBoostUntil) b.armorBoostUntil = 0;
    if (b.invulnerableUntil > 0 && now > b.invulnerableUntil) b.invulnerableUntil = 0;
    if (b.lifestealBoostUntil > 0 && now > b.lifestealBoostUntil) b.lifestealBoostUntil = 0;
  }

  private updatePlayer(dt: number): void {
    const now = performance.now() / 1000;
    let speedMult = 1;
    if (this.buffs.speedBoostUntil > now) speedMult *= 1.5;
    if (this.buffs.berserkUntil > now) speedMult *= 1.2;

    const speed = this.playerStats.speed * speedMult;
    let dx = 0, dy = 0;
    if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
    if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) dx += 1;

    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.sqrt(2);
      dx *= inv; dy *= inv;
    }

    this.isMoving = dx !== 0 || dy !== 0;
    if (this.isMoving) this.facingAngle = Math.atan2(dy, dx);

    this.playerX += dx * speed * dt;
    this.playerY += dy * speed * dt;

    const padding = 20;
    this.playerX = Math.max(padding, Math.min(this.canvasWidth - padding, this.playerX));
    this.playerY = Math.max(padding, Math.min(this.canvasHeight - padding, this.playerY));
  }

  private updateClones(dt: number, now: number): void {
    this.clones = this.clones.filter(c => c.expiresAt > now);
    for (const clone of this.clones) {
      clone.cooldown -= dt;
      if (clone.cooldown > 0) continue;
      clone.cooldown = 0.5;

      let nearest: Enemy | null = null;
      let nearestDist = Infinity;
      for (const e of this.enemies) {
        const d = Math.hypot(e.x - clone.x, e.y - clone.y);
        if (d < nearestDist && d < 300) { nearestDist = d; nearest = e; }
      }
      if (nearest) {
        const dx = nearest.x - clone.x;
        const dy = nearest.y - clone.y;
        const dist = Math.hypot(dx, dy);
        const speed = 600;
        this.bullets.push({
          id: this.bulletIdCounter++,
          x: clone.x, y: clone.y,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          damage: 10 * this.playerStats.damageMultiplier,
          radius: 4, color: '#4ecdc4',
          fromPlayer: true, lifetime: 0.6,
          pierce: 0, hitIds: [],
          behavior: 'single', isCrit: false, damageType: 'normal'
        });
      }
    }
  }

  private updateEnemies(dt: number, now: number): void {
    for (const enemy of this.enemies) {
      if (enemy.frozenUntil && now < enemy.frozenUntil) continue;

      let moveSpeed = enemy.speed;
      if (enemy.slowUntil && now < enemy.slowUntil) moveSpeed *= 0.5;

      const dx = this.playerX - enemy.x;
      const dy = this.playerY - enemy.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01) {
        enemy.x += (dx / dist) * moveSpeed * dt;
        enemy.y += (dy / dist) * moveSpeed * dt;
      }

      if (enemy.burnTicks && enemy.burnTicks > 0 && Math.random() < dt * 4) {
        const dmg = enemy.burnDamage ?? 3;
        enemy.hp -= dmg;
        this.spawnParticle(enemy.x, enemy.y, 'fire');
        if (enemy.hp <= 0) this.killEnemy(enemy);
      }

      if (enemy.isBoss) {
        enemy.abilityTimer = (enemy.abilityTimer ?? 5) - dt;
        if (enemy.abilityTimer <= 0) {
          enemy.abilityTimer = 6 + Math.random() * 3;
          this.bossAbility(enemy);
        }
      }
    }

    this.enemies = this.enemies.filter(e => e.hp > 0);

    const isTank = this.selectedCharacter()?.id === 'tank';
    for (const enemy of this.enemies) {
      const dx = this.playerX - enemy.x;
      const dy = this.playerY - enemy.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 16 + enemy.radius) {
        this.damagePlayer(enemy.damage * dt * 3, enemy);
        if (!isTank) {
          const angle = Math.atan2(dy, dx);
          enemy.x -= Math.cos(angle) * 40;
          enemy.y -= Math.sin(angle) * 40;
        }
      }
    }
  }

  private bossAbility(boss: Enemy): void {
    if (boss.type === 'boss_goblin') {
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const x = boss.x + Math.cos(angle) * 60;
        const y = boss.y + Math.sin(angle) * 60;
        const hp = 30 + this.state().wave * 4;
        this.enemies.push({
          id: this.enemyIdCounter++, x, y,
          hp, maxHp: hp, speed: 90, damage: 8,
          radius: 10, color: '#f1c40f', type: 'goblin',
          moneyDrop: 1 + Math.floor(this.state().wave / 10)
        });
      }
      this.spawnAbilityFx('#f1c40f');
    } else if (boss.type === 'boss_reaper') {
      boss.x = this.playerX + (Math.random() - 0.5) * 100;
      boss.y = this.playerY + (Math.random() - 0.5) * 100;
      boss.x = Math.max(40, Math.min(this.canvasWidth - 40, boss.x));
      boss.y = Math.max(40, Math.min(this.canvasHeight - 40, boss.y));
      this.spawnAbilityFx('#9b59b6');
    } else if (boss.type === 'boss_titan') {
      this.explode(boss.x, boss.y, 150, 25);
      this.state.update(s => ({ ...s, screenShake: 12 }));
    }
  }

  private updateBullets(dt: number): void {
    const remaining: Bullet[] = [];

    for (const b of this.bullets) {
      if (Math.random() < 0.5) {
        this.particles.push({
          id: this.particleIdCounter++,
          x: b.x, y: b.y,
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30,
          life: 0.25, maxLife: 0.25,
          color: b.color, size: 3, kind: 'spark'
        });
      }

      if (b.behavior === 'boomerang') {
        if (!b.boomerangReturning) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.lifetime -= dt;
          if (b.lifetime <= 0) {
            b.boomerangReturning = true;
            b.lifetime = 2;
          }
        } else {
          const dx = this.playerX - b.x;
          const dy = this.playerY - b.y;
          const d = Math.hypot(dx, dy);
          const speed = 500;
          b.vx = (dx / d) * speed;
          b.vy = (dy / d) * speed;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (d < 25) {
            b.hitIds = [];
            b.boomerangReturning = false;
            b.lifetime = 0.7;
          }
        }
      } else {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.lifetime -= dt;
      }

      if (b.x < -50 || b.x > this.canvasWidth + 50 ||
          b.y < -50 || b.y > this.canvasHeight + 50) {
        if (b.behavior !== 'boomerang') continue;
      }

      if (b.lifetime <= 0 && b.behavior !== 'boomerang') continue;

      let consumed = false;
      if (b.fromPlayer) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (b.hitIds.includes(e.id)) continue;
          const dx = b.x - e.x;
          const dy = b.y - e.y;
          if (Math.hypot(dx, dy) < e.radius + b.radius) {
            b.hitIds.push(e.id);
            this.applyBulletHit(b, e);

            if (b.behavior === 'pierce' && b.pierce > 0) {
              b.pierce--;
            } else if (b.behavior === 'boomerang') {
              // continua
            } else {
              consumed = true;
              break;
            }
          }
        }
      }
      if (!consumed) remaining.push(b);
    }

    this.bullets = remaining;
  }

  private applyBulletHit(b: Bullet, e: Enemy): void {
    this.damageEnemy(e, b.damage, b.isCrit ?? false);

    if (b.behavior === 'explosive' && b.explosiveRadius) {
      this.explode(b.x, b.y, b.explosiveRadius, b.damage * 0.6);
    }
    if (b.behavior === 'chain' && b.chainCount && b.chainRange) {
      this.chainLightning(e, b, b.chainCount, b.chainRange);
    }

    const hasElemental = this.state().ownedLegendaryItems.includes('elementalMaster');

    if (b.damageType === 'fire' || hasElemental) {
      e.burnTicks = 3;
      e.burnDamage = Math.ceil(b.damage * 0.3);
    }
    if (b.damageType === 'ice' || hasElemental) {
      e.slowUntil = performance.now() / 1000 + 2;
    }
  }

  private explode(x: number, y: number, radius: number, damage: number): void {
    this.spawnExplosion(x, y, radius);
    this.state.update(s => ({ ...s, screenShake: Math.max(s.screenShake, 8) }));

    for (const enemy of this.enemies) {
      const d = Math.hypot(enemy.x - x, enemy.y - y);
      if (d < radius + enemy.radius) {
        const falloff = 1 - Math.min(1, d / radius);
        this.damageEnemy(enemy, damage * falloff, false);
      }
    }
  }

  private chainLightning(source: Enemy, bullet: Bullet, count: number, range: number): void {
    const hit = new Set<number>([source.id]);
    let current: Enemy = source;
    for (let i = 0; i < count; i++) {
      let nearest: Enemy | null = null;
      let nd = range;
      for (const e of this.enemies) {
        if (hit.has(e.id)) continue;
        const d = Math.hypot(e.x - current.x, e.y - current.y);
        if (d < nd) { nd = d; nearest = e; }
      }
      if (!nearest) break;
      hit.add(nearest.id);
      this.damageEnemy(nearest, bullet.damage * 0.8, false);
      this.spawnLightning(current.x, current.y, nearest.x, nearest.y);
      current = nearest;
    }
  }

  private killEnemy(enemy: Enemy): void {
    this.enemies = this.enemies.filter(e => e.id !== enemy.id);
    const items = this.state().ownedRareItems;
    const legendary = this.state().ownedLegendaryItems;

    let materialGain = 1;
    if (legendary.includes('soulHarvest')) materialGain *= 2;

    this.state.update(s => ({
      ...s,
      kills: s.kills + 1,
      materials: s.materials + materialGain
    }));

    if (enemy.moneyDrop && enemy.moneyDrop > 0) {
      let dropAmount = enemy.moneyDrop;
      if (legendary.includes('treasureHunter')) dropAmount *= 2;
      for (let i = 0; i < dropAmount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 80;
        this.moneyPickups.push({
          id: this.moneyIdCounter++,
          x: enemy.x, y: enemy.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          value: 1 + Math.floor(Math.random() * 3),
          lifetime: 15
        });
      }
    }

    if (enemy.diamondDrop && enemy.diamondDrop > 0) {
      for (let i = 0; i < enemy.diamondDrop; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 60;
        this.diamondPickups.push({
          id: this.diamondIdCounter++,
          x: enemy.x, y: enemy.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          value: 1,
          lifetime: 30
        });
      }
    }

    if (enemy.isBoss) {
      const diamondCount = 3 + Math.floor(this.state().wave / 10);
      for (let i = 0; i < diamondCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 100;
        this.diamondPickups.push({
          id: this.diamondIdCounter++,
          x: enemy.x, y: enemy.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          value: 1,
          lifetime: 40
        });
      }

      this.bossState.active = false;
      this.state.update(s => ({ ...s, bossActive: false, bossName: undefined }));
      this.spawnExplosion(enemy.x, enemy.y, 120);
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 100 + Math.random() * 250;
        this.particles.push({
          id: this.particleIdCounter++,
          x: enemy.x, y: enemy.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0, maxLife: 1.0,
          color: i % 3 === 0 ? '#f1c40f' : enemy.color,
          size: 5, kind: 'spark'
        });
      }
    }

    for (let i = 0; i < 8; i++) {
      this.particles.push({
        id: this.particleIdCounter++,
        x: enemy.x, y: enemy.y,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        life: 0.5, maxLife: 0.5,
        color: enemy.color, size: 3, kind: 'spark'
      });
    }
  }

  private damageEnemy(enemy: Enemy, damage: number, isCrit: boolean): void {
    const items = this.state().ownedRareItems;
    if (items.includes('executioner') && !enemy.isBoss &&
        enemy.hp / enemy.maxHp < 0.15) {
      damage = enemy.hp + 1;
    }

    enemy.hp -= damage;
    this.state.update(s => ({ ...s, damageDealt: s.damageDealt + damage }));

    this.damageTexts.push({
      id: this.damageTextIdCounter++,
      x: enemy.x + (Math.random() - 0.5) * 12,
      y: enemy.y - 12,
      value: Math.round(damage),
      color: isCrit ? '#f1c40f' : damage >= 30 ? '#ff8c00' : '#ffffff',
      lifetime: isCrit ? 1.0 : 0.7,
      vy: -50, isCrit
    });

    if (this.buffs.berserkUntil > performance.now() / 1000) {
      this.healPlayer(damage * 0.05);
    }

    if (isCrit) this.spawnParticle(enemy.x, enemy.y, 'ring');
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  private updateWeapons(dt: number, now: number): void {
    const charId = this.selectedCharacter()?.id;
    let attackSpeedMult = this.playerStats.attackSpeed;
    if (this.buffs.cadenceBoostUntil > now) attackSpeedMult *= 1.5;
    if (this.buffs.berserkUntil > now) attackSpeedMult *= 3;

    for (let i = 0; i < this.currentWeapons.length; i++) {
      this.weaponCooldowns[i] -= dt * 1000;
      if (this.weaponCooldowns[i] > 0) continue;

      const weapon = this.currentWeapons[i];
      let effectiveCooldown = weapon.cooldown / attackSpeedMult;

      if (charId === 'doctor') {
        const isMedical = weapon.damage >= 20;
        effectiveCooldown = isMedical ? weapon.cooldown / 3 : weapon.cooldown * 2;
      }

      const effectiveRange = weapon.range * this.playerStats.range;
      const target = this.findTarget(weapon, effectiveRange);
      if (!target) continue;

      this.fireWeapon(weapon, target, effectiveRange);
      this.weaponCooldowns[i] = effectiveCooldown;
    }
  }

  private findTarget(weapon: Weapon, effectiveRange: number): Enemy | null {
    const s = this.state();
    let best: Enemy | null = null;

    if (s.autoAim) {
      let bestCone: Enemy | null = null;
      let bestConeDist = Infinity;
      let bestGlobal: Enemy | null = null;
      let bestGlobalDist = Infinity;
      const coneHalf = Math.PI / 3;

      for (const e of this.enemies) {
        const dx = e.x - this.playerX;
        const dy = e.y - this.playerY;
        const dist = Math.hypot(dx, dy);
        if (dist > effectiveRange) continue;
        if (e.isBoss) return e;
        if (dist < bestGlobalDist) { bestGlobalDist = dist; bestGlobal = e; }

        const angle = Math.atan2(dy, dx);
        let diff = Math.abs(angle - this.facingAngle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (diff <= coneHalf && dist < bestConeDist) {
          bestConeDist = dist; bestCone = e;
        }
      }
      best = bestCone ?? bestGlobal;
    } else {
      let bestAlign = Infinity;
      for (const e of this.enemies) {
        const dx = e.x - this.playerX;
        const dy = e.y - this.playerY;
        const dist = Math.hypot(dx, dy);
        if (dist > effectiveRange) continue;
        const angle = Math.atan2(dy, dx);
        let diff = Math.abs(angle - this.facingAngle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (diff < bestAlign) { bestAlign = diff; best = e; }
      }
    }
    return best;
  }

  private fireWeapon(weapon: Weapon, target: Enemy, effectiveRange: number): void {
    const dx = target.x - this.playerX;
    const dy = target.y - this.playerY;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return;

    const charId = this.selectedCharacter()?.id;
    const now = performance.now() / 1000;
    const items = this.state().ownedRareItems;

    let damage = weapon.damage * this.playerStats.damageMultiplier;

    if (weapon.type === 'melee') damage += this.playerStats.meleeBonus;
    else damage += this.playerStats.rangedBonus;

    if (charId === 'mage') damage *= 1 + 0.08 * this.currentWeapons.length;
    if (charId === 'engineer' && weapon.behavior === 'explosive') damage *= 1.3;
    if (charId === 'speedy') damage *= this.isMoving ? 1.4 : 0.6;

    if (items.includes('overcharge')) damage *= 1.5;

    if (this.buffs.damageBoostUntil > now) damage *= 2;
    if (this.buffs.berserkUntil > now) damage *= 3;
    if (this.buffs.nextShotLethal) {
      damage *= 5;
      this.buffs.nextShotLethal = false;
      this.state.update(s => ({ ...s, screenShake: 12 }));
    }

    damage = Math.max(1, damage);

    let critChance = this.playerStats.critChance;
    if (this.state().ownedLegendaryItems.includes('perfectAim')) critChance = 1;
    if (this.buffs.critBoostUntil > now) critChance = Math.min(1, critChance + 0.5);

    const isCrit = Math.random() < critChance;
    if (isCrit) damage *= this.playerStats.critMultiplier;

    if (weapon.type === 'ranged' && weapon.projectileSpeed) {
      this.spawnProjectiles(weapon, dx, dy, dist, damage, isCrit);
    } else {
      this.damageEnemy(target, damage, isCrit);
      const angle = Math.atan2(dy, dx);
      target.x += Math.cos(angle) * 8;
      target.y += Math.sin(angle) * 8;

      let ls = this.playerStats.lifesteal;
      if (items.includes('vampirism')) ls += 5;
      ls *= (this.buffs.lifestealBoostUntil > now ? 2 : 1);
      if (ls > 0) this.healPlayer(ls);

      this.spawnParticle(target.x, target.y, 'ring');
    }
  }

  private spawnProjectiles(
    weapon: Weapon, dx: number, dy: number, dist: number,
    damage: number, isCrit: boolean
  ): void {
    const items = this.state().ownedRareItems;
    let projectiles = weapon.projectiles ?? 1;
    if (items.includes('duplicator')) projectiles += 1;
    const spread = weapon.spread ?? 0;
    const baseAngle = Math.atan2(dy, dx);

    let explosiveRadius = weapon.explosionRadius;
    if (explosiveRadius && this.selectedCharacter()?.id === 'engineer') {
      explosiveRadius *= 1.5;
    }

    for (let p = 0; p < projectiles; p++) {
      const offset = projectiles === 1
        ? 0
        : (p - (projectiles - 1) / 2) * spread;

      const angle = baseAngle + offset;
      const speed = weapon.projectileSpeed!;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      let damageType: Bullet['damageType'] = 'normal';
      if (weapon.id === 'flamethrower') damageType = 'fire';
      if (weapon.id === 'lightningGun') damageType = 'lightning';

      this.bullets.push({
        id: this.bulletIdCounter++,
        x: this.playerX, y: this.playerY,
        vx, vy, damage,
        radius: isCrit ? 6 : 4,
        color: isCrit ? '#f1c40f' : weapon.color,
        fromPlayer: true,
        lifetime: weapon.range / speed,
        pierce: weapon.pierce ?? 0,
        hitIds: [],
        behavior: weapon.behavior,
        explosiveRadius,
        chainCount: weapon.chainCount,
        chainRange: weapon.chainRange,
        bouncesLeft: weapon.behavior === 'boomerang' ? 1 : 0,
        boomerangReturning: false,
        originX: this.playerX,
        originY: this.playerY,
        isCrit,
        trailColor: weapon.color,
        damageType
      });
    }

    if (isCrit) {
      this.state.update(s => ({
        ...s, screenShake: Math.max(s.screenShake, 3)
      }));
    }
  }

  private updateAbilityCooldowns(dt: number): void {
    const s = this.state();
    if (s.ownedLegendaryItems.includes('infiniteEnergy')) {
      const cleared: Record<string, number> = {};
      for (const id of Object.keys(s.abilityCooldowns)) cleared[id] = 0;
      if (JSON.stringify(cleared) !== JSON.stringify(s.abilityCooldowns)) {
        this.state.update(st => ({ ...st, abilityCooldowns: cleared }));
      }
      return;
    }
    const cd = { ...s.abilityCooldowns };
    let changed = false;
    for (const id of Object.keys(cd)) {
      if (cd[id] > 0) {
        cd[id] = Math.max(0, cd[id] - dt);
        changed = true;
      }
    }
    if (changed) this.state.update(st => ({ ...st, abilityCooldowns: cd }));
  }

  useActiveAbility(key: string): void {
    const char = this.selectedCharacter();
    if (!char) return;
    const ability = char.abilities.find(a => a.trigger === 'active' && a.key === key);
    if (!ability) return;

    const s = this.state();
    if ((s.abilityCooldowns[ability.id] ?? 0) > 0) return;

    this.activateAbility(ability.id);
    this.state.update(st => ({
      ...st,
      abilityCooldowns: {
        ...st.abilityCooldowns,
        [ability.id]: ability.cooldown ?? 10
      }
    }));
  }

  private activateAbility(id: string): void {
    const now = performance.now() / 1000;

    switch (id) {
      case 'focus':
        this.buffs.critBoostUntil = now + 4;
        this.buffs.cadenceBoostUntil = now + 4;
        this.spawnAbilityFx('#4ecdc4');
        break;
      case 'rage':
        this.buffs.damageBoostUntil = now + 5;
        this.buffs.speedBoostUntil = now + 5;
        this.spawnAbilityFx('#e74c3c');
        break;
      case 'killshot':
        this.buffs.nextShotLethal = true;
        this.spawnAbilityFx('#f39c12');
        break;
      case 'dash': {
        const dist = 140;
        this.playerX += Math.cos(this.facingAngle) * dist;
        this.playerY += Math.sin(this.facingAngle) * dist;
        this.playerX = Math.max(20, Math.min(this.canvasWidth - 20, this.playerX));
        this.playerY = Math.max(20, Math.min(this.canvasHeight - 20, this.playerY));
        this.explode(this.playerX, this.playerY, 90, 40);
        this.spawnAbilityFx('#2ecc71');
        break;
      }
      case 'fortress':
        this.buffs.invulnerableUntil = now + 5;
        this.buffs.armorBoostUntil = now + 5;
        this.spawnAbilityFx('#9b59b6');
        break;
      case 'triage':
        this.healPlayer(50);
        this.buffs.lifestealBoostUntil = now + 6;
        this.spawnHealFx();
        break;
      case 'arcane_nova': {
        this.explode(this.playerX, this.playerY, 160, 70);
        for (const e of this.enemies) {
          const dx = e.x - this.playerX;
          const dy = e.y - this.playerY;
          const d = Math.hypot(dx, dy);
          if (d < 200 && d > 0) {
            e.x += (dx / d) * 80;
            e.y += (dy / d) * 80;
          }
        }
        this.state.update(s => ({ ...s, screenShake: 15 }));
        this.spawnAbilityFx('#ff69b4');
        break;
      }
      case 'barrage': {
        const snapshot = [...this.enemies];
        for (const e of snapshot) this.explode(e.x, e.y, 70, 45);
        this.spawnAbilityFx('#e67e22');
        break;
      }
    }
  }

  private updateSpecialCooldown(dt: number): void {
    const s = this.state();
    if (s.ownedLegendaryItems.includes('infiniteEnergy')) {
      if (s.specialAbilityCooldown !== 0) {
        this.state.update(st => ({ ...st, specialAbilityCooldown: 0 }));
      }
      return;
    }
    if (s.specialAbilityCooldown > 0) {
      this.state.update(st => ({
        ...st,
        specialAbilityCooldown: Math.max(0, st.specialAbilityCooldown - dt)
      }));
    }
  }

  useSpecialAbility(): void {
    const s = this.state();
    if (!s.specialAbilityId) return;
    if (s.specialAbilityCooldown > 0) return;

    const ability = SPECIAL_ABILITIES.find(a => a.id === s.specialAbilityId);
    if (!ability) return;

    this.activateSpecialAbility(ability.id);
    this.state.update(st => ({
      ...st,
      specialAbilityCooldown: ability.cooldown
    }));
  }

  private activateSpecialAbility(id: SpecialAbilityId): void {
    const now = performance.now() / 1000;

    switch (id) {
      case 'meteor': {
        for (let i = 0; i < 8; i++) {
          const x = Math.random() * this.canvasWidth;
          const y = Math.random() * this.canvasHeight;
          setTimeout(() => {
            this.explode(x, y, 80, 60);
            this.spawnAbilityFx('#ff8c00');
          }, i * 120);
        }
        break;
      }
      case 'blackhole': {
        for (const e of this.enemies) {
          const dx = this.playerX - e.x;
          const dy = this.playerY - e.y;
          const d = Math.hypot(dx, dy);
          if (d < 400 && d > 0) {
            e.x += (dx / d) * 150;
            e.y += (dy / d) * 150;
            this.damageEnemy(e, 30, false);
          }
        }
        this.state.update(s => ({ ...s, screenShake: 15 }));
        this.spawnAbilityFx('#2c3e50');
        break;
      }
      case 'timeFreeze': {
        const until = now + 5;
        for (const e of this.enemies) e.frozenUntil = until;
        this.spawnAbilityFx('#00bfff');
        break;
      }
      case 'healBurst':
        this.healPlayer(this.state().playerMaxHp);
        this.buffs.invulnerableUntil = now + 3;
        this.spawnHealFx();
        break;
      case 'thunderstorm': {
        const snapshot = [...this.enemies];
        for (const e of snapshot) {
          this.damageEnemy(e, 80, false);
          this.spawnLightning(e.x, e.y - 200, e.x, e.y);
        }
        this.state.update(s => ({ ...s, screenShake: 10 }));
        break;
      }
      case 'nuke': {
        const snapshot = [...this.enemies];
        for (const e of snapshot) {
          this.damageEnemy(e, 300, true);
          this.explode(e.x, e.y, 100, 80);
        }
        this.state.update(s => ({ ...s, screenShake: 25 }));
        this.spawnAbilityFx('#ff4500');
        break;
      }
      case 'clone': {
        this.clones = [];
        for (let i = 0; i < 2; i++) {
          const angle = (i / 2) * Math.PI * 2;
          this.clones.push({
            x: this.playerX + Math.cos(angle) * 50,
            y: this.playerY + Math.sin(angle) * 50,
            expiresAt: now + 10,
            cooldown: 0
          });
        }
        this.spawnAbilityFx('#4ecdc4');
        break;
      }
      case 'berserk':
        this.buffs.berserkUntil = now + 8;
        this.spawnAbilityFx('#e74c3c');
        break;
    }
  }

  openBlackMarket(): void {
    this.state.update(s => ({ ...s, status: 'blackMarket' }));
  }

  closeBlackMarket(): void {
    this.state.update(s => ({ ...s, status: 'shop' }));
  }

  openLegendaryShop(): void {
    this.state.update(s => ({ ...s, status: 'legendaryShop' }));
  }

  closeLegendaryShop(): void {
    this.state.update(s => ({ ...s, status: 'shop' }));
  }

  buySpecialAbility(id: SpecialAbilityId): boolean {
    const s = this.state();
    const ability = SPECIAL_ABILITIES.find(a => a.id === id);
    if (!ability) return false;
    if (s.money < ability.price) return false;

    this.state.update(st => ({
      ...st,
      money: st.money - ability.price,
      specialAbilityId: id,
      specialAbilityCooldown: 0
    }));
    return true;
  }

  buyRareItem(id: RareItemId): boolean {
    const s = this.state();
    const item = RARE_ITEMS.find(i => i.id === id);
    if (!item) return false;
    if (s.money < item.price) return false;
    if (s.ownedRareItems.includes(id)) return false;

    this.applyRareItemEffect(id);
    this.state.update(st => ({
      ...st,
      money: st.money - item.price,
      ownedRareItems: [...st.ownedRareItems, id]
    }));
    return true;
  }

  private applyRareItemEffect(id: RareItemId): void {
    switch (id) {
      case 'overcharge': this.playerStats.damageMultiplier *= 1.5; break;
      case 'warpSpeed': this.playerStats.speed *= 1.4; break;
      case 'guardian': this.playerStats.armor += 5; break;
      case 'ghost':
        this.playerStats.dodge = Math.min(0.75, this.playerStats.dodge + 0.25);
        break;
      case 'vampirism': this.playerStats.lifesteal += 5; break;
    }
  }

  buyLegendaryItem(id: LegendaryItemId): boolean {
    const s = this.state();
    const item = LEGENDARY_ITEMS.find(i => i.id === id);
    if (!item) return false;
    if (s.diamonds < item.price) return false;
    if (s.ownedLegendaryItems.includes(id)) return false;

    this.applyLegendaryEffect(id);
    this.state.update(st => ({
      ...st,
      diamonds: st.diamonds - item.price,
      ownedLegendaryItems: [...st.ownedLegendaryItems, id]
    }));
    return true;
  }

  private applyLegendaryEffect(id: LegendaryItemId): void {
    switch (id) {
      case 'deathRay': this.maxWeaponSlots = 7; break;
      case 'divineShield':
        this.state.update(s => ({ ...s, hasRevive: true }));
        break;
    }
  }

  getUpgradePrice(id: UpgradeId): number {
    const up = UPGRADES.find(u => u.id === id);
    if (!up) return 0;
    const level = this.state().upgrades[id];
    return Math.floor(up.basePrice * Math.pow(up.priceScale, level));
  }

  buyUpgrade(id: UpgradeId): boolean {
    const s = this.state();
    const up = UPGRADES.find(u => u.id === id);
    if (!up) return false;

    const currentLevel = s.upgrades[id];
    if (currentLevel >= up.maxLevel) return false;

    const price = this.getUpgradePrice(id);
    if (s.money < price) return false;

    this.applyUpgrade(id, up.effectPerLevel);

    const newUpgrades = { ...s.upgrades };
    newUpgrades[id] = currentLevel + 1;

    this.state.update(st => ({
      ...st,
      money: st.money - price,
      upgrades: newUpgrades
    }));

    return true;
  }

  private applyUpgrade(id: UpgradeId, effect: number): void {
    switch (id) {
      case 'maxHp':
        this.playerStats.maxHp += effect;
        this.baseStats.maxHp += effect;
        this.state.update(s => ({
          ...s,
          playerMaxHp: this.playerStats.maxHp,
          playerHp: Math.min(s.playerHp + effect, this.playerStats.maxHp)
        }));
        break;
      case 'armor': this.playerStats.armor += effect; break;
      case 'speed': this.playerStats.speed += effect; break;
      case 'damage': this.playerStats.damageMultiplier += effect; break;
      case 'attackSpeed': this.playerStats.attackSpeed += effect; break;
      case 'harvesting': this.playerStats.harvesting += effect; break;
      case 'critChance': this.playerStats.critChance += effect; break;
    }
  }

  tryBuyWeapon(weapon: Weapon): void {
    const s = this.state();
    const cost = 10 + s.wave * 2;
    if (s.materials < cost) return;

    if (this.currentWeapons.length < this.maxWeaponSlots) {
      this.state.update(st => ({ ...st, materials: st.materials - cost }));
      this.currentWeapons.push({ ...weapon });
      this.weaponCooldowns.push(0);
    } else {
      this.state.update(st => ({
        ...st,
        status: 'replaceWeapon',
        pendingWeapon: weapon,
        pendingWeaponPrice: cost
      }));
    }
  }

  confirmReplaceWeapon(slotIndex: number): void {
    const s = this.state();
    if (!s.pendingWeapon || s.pendingWeaponPrice === undefined) return;

    this.state.update(st => ({ ...st, materials: st.materials - s.pendingWeaponPrice! }));
    this.currentWeapons[slotIndex] = { ...s.pendingWeapon };
    this.weaponCooldowns[slotIndex] = 0;

    this.state.update(st => ({
      ...st,
      status: 'shop',
      pendingWeapon: undefined,
      pendingWeaponPrice: undefined
    }));
  }

  cancelReplaceWeapon(): void {
    this.state.update(st => ({
      ...st,
      status: 'shop',
      pendingWeapon: undefined,
      pendingWeaponPrice: undefined
    }));
  }

  sellWeapon(slotIndex: number): void {
    const weapon = this.currentWeapons[slotIndex];
    if (!weapon) return;
    const refund = Math.floor((10 + this.state().wave * 2) * 0.4);
    this.currentWeapons.splice(slotIndex, 1);
    this.weaponCooldowns.splice(slotIndex, 1);
    this.state.update(st => ({ ...st, materials: st.materials + refund }));
  }

  buyWeapon(weapon: Weapon): boolean {
    this.tryBuyWeapon(weapon);
    return true;
  }

  private updateSpawning(dt: number): void {
    const s = this.state();

    if (s.wave % 10 === 0 && !this.bossState.active && this.enemies.length === 0) {
      this.spawnBoss(s.wave);
      return;
    }

    if (this.bossState.active) {
      const spawnRate = 0.15;
      if (Math.random() < spawnRate * dt) this.spawnNormalEnemy(s.wave);
      return;
    }

    const spawnRate = 1.2 + s.wave * 0.22;
    if (Math.random() >= spawnRate * dt) return;

    let goblinChance = 0.025 + s.wave * 0.0025;
    if (s.ownedLegendaryItems.includes('treasureHunter')) goblinChance *= 3;
    if (Math.random() < goblinChance) {
      this.spawnGoblin(s.wave);
      return;
    }

    this.spawnNormalEnemy(s.wave);
  }

  private spawnNormalEnemy(wave: number): void {
    const margin = 40;
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    switch (side) {
      case 0: x = Math.random() * this.canvasWidth; y = -margin; break;
      case 1: x = this.canvasWidth + margin; y = Math.random() * this.canvasHeight; break;
      case 2: x = Math.random() * this.canvasWidth; y = this.canvasHeight + margin; break;
      default: x = -margin; y = Math.random() * this.canvasHeight; break;
    }

    const roll = Math.random();
    let type: Enemy['type'] = 'normal';
    let hp = 20 + wave * 8;
    let speed = 70 + wave * 4;
    let damage = 6 + wave * 3;
    let radius = 12;
    let color = '#e74c3c';

    if (roll < 0.25 && wave >= 2) {
      type = 'fast'; hp = 14 + wave * 5;
      speed = 130 + wave * 6; damage = 5 + wave * 2;
      radius = 8; color = '#f39c12';
    } else if (roll < 0.42 && wave >= 4) {
      type = 'tank'; hp = 55 + wave * 18;
      speed = 45 + wave * 3; damage = 14 + wave * 4;
      radius = 20; color = '#8e44ad';
    }

    this.enemies.push({
      id: this.enemyIdCounter++,
      x, y, hp, maxHp: hp, speed, damage, radius, color, type
    });
  }

  private spawnGoblin(wave: number): void {
    const margin = 40;
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    switch (side) {
      case 0: x = Math.random() * this.canvasWidth; y = -margin; break;
      case 1: x = this.canvasWidth + margin; y = Math.random() * this.canvasHeight; break;
      case 2: x = Math.random() * this.canvasWidth; y = this.canvasHeight + margin; break;
      default: x = -margin; y = Math.random() * this.canvasHeight; break;
    }

    const hp = 30 + wave * 10;
    const isDiamondGoblin = Math.random() < 0.08;

    this.enemies.push({
      id: this.enemyIdCounter++,
      x, y, hp, maxHp: hp,
      speed: 140 + wave * 4,
      damage: 3,
      radius: isDiamondGoblin ? 13 : 11,
      color: isDiamondGoblin ? '#00ffff' : '#f1c40f',
      type: 'goblin',
      moneyDrop: 3 + Math.floor(wave / 5),
      diamondDrop: isDiamondGoblin ? 1 : 0
    });
  }

  private spawnBoss(wave: number): void {
    const bossLevel = wave / 10;
    let bossType: Enemy['type'] = 'boss_goblin';
    let bossName = 'Rei Goblin';
    let color = '#f1c40f';
    let radius = 40;

    if (bossLevel % 3 === 2) {
      bossType = 'boss_reaper'; bossName = 'Ceifador Sombrio';
      color = '#8e44ad'; radius = 42;
    } else if (bossLevel % 3 === 0) {
      bossType = 'boss_titan'; bossName = 'Titã Ancestral';
      color = '#c0392b'; radius = 48;
    }

    const hp = 900 + wave * 180;
    const speed = 45 + bossLevel * 6;
    const damage = 18 + bossLevel * 10;

    this.enemies.push({
      id: this.enemyIdCounter++,
      x: this.canvasWidth / 2, y: -80,
      hp, maxHp: hp, speed, damage, radius, color,
      type: bossType, isBoss: true, bossName,
      moneyDrop: 20 + bossLevel * 8,
      abilityTimer: 5
    });

    this.bossState.active = true;
    this.bossState.name = bossName;
    this.bossState.level = bossLevel;

    this.state.update(s => ({
      ...s, bossActive: true, bossName, screenShake: 20
    }));
  }

  private updateMoneyPickups(dt: number): void {
    const items = this.state().ownedRareItems;
    const legendary = this.state().ownedLegendaryItems;
    const magnetRadius = legendary.includes('diamondMagnet') ? 9999 :
                          items.includes('magnet') ? 200 : 0;

    this.moneyPickups = this.moneyPickups.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.lifetime -= dt;

      const dx = this.playerX - p.x;
      const dy = this.playerY - p.y;
      const d = Math.hypot(dx, dy);

      if (magnetRadius > 0 && d < magnetRadius && d > 0.01) {
        p.x += (dx / d) * 400 * dt;
        p.y += (dy / d) * 400 * dt;
      }

      if (d < 25) {
        this.state.update(s => ({ ...s, money: s.money + p.value }));
        this.damageTexts.push({
          id: this.damageTextIdCounter++,
          x: p.x, y: p.y, value: p.value,
          color: '#f1c40f', lifetime: 1.0, vy: -60,
          isCrit: false, isMoney: true
        });
        return false;
      }

      return p.lifetime > 0;
    });
  }

  private updateDiamondPickups(dt: number): void {
    const legendary = this.state().ownedLegendaryItems;
    const magnetRadius = legendary.includes('diamondMagnet') ? 9999 : 150;

    this.diamondPickups = this.diamondPickups.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.lifetime -= dt;

      const dx = this.playerX - p.x;
      const dy = this.playerY - p.y;
      const d = Math.hypot(dx, dy);

      if (magnetRadius > 0 && d < magnetRadius && d > 0.01) {
        p.x += (dx / d) * 350 * dt;
        p.y += (dy / d) * 350 * dt;
      }

      if (d < 25) {
        this.state.update(s => ({ ...s, diamonds: s.diamonds + p.value }));
        this.damageTexts.push({
          id: this.damageTextIdCounter++,
          x: p.x, y: p.y, value: p.value,
          color: '#00ffff', lifetime: 1.2, vy: -70,
          isCrit: false, isDiamond: true
        });
        return false;
      }

      return p.lifetime > 0;
    });
  }

  private updateTimer(dt: number): void {
    const s = this.state();
    const newTime = s.timeLeft - dt;
    if (newTime <= 0) this.endWave(s);
    else this.state.update(st => ({ ...st, timeLeft: newTime }));
  }

  private endWave(s: GameState): void {
    const harvest = this.playerStats.harvesting;
    const newMaterials = s.materials + harvest;
    const nextWave = s.wave + 1;

    let waveTime = GameEngineService.waveDuration(nextWave);
    if (s.ownedLegendaryItems.includes('timeLord')) waveTime += 10;

    this.stopLoop();
    this.state.set({
      ...s,
      status: 'shop',
      wave: nextWave,
      timeLeft: waveTime,
      waveDuration: waveTime,
      materials: newMaterials,
      pausedFrom: undefined
    });
    this.availableWeapons.set(this.generateShopWeapons());
  }

  private damagePlayer(amount: number, source?: Enemy): void {
    const now = performance.now() / 1000;
    if (this.buffs.invulnerableUntil > now) return;
    if (Math.random() < this.playerStats.dodge) {
      this.damageTexts.push({
        id: this.damageTextIdCounter++,
        x: this.playerX, y: this.playerY - 20,
        value: 0, color: '#2ecc71', lifetime: 0.5,
        vy: -40, isCrit: false
      });
      return;
    }

    let armor = this.playerStats.armor;
    const charId = this.selectedCharacter()?.id;
    if (charId === 'speedy' && !this.isMoving) armor = 0;
    if (this.buffs.armorBoostUntil > now) armor += 30;

    if (charId === 'speedy' && this.isMoving && Math.random() < 0.2) return;

    const reduction = armor / (armor + 15);
    const finalDamage = amount * (1 - reduction);

    if (charId === 'tank' && source) {
      this.damageEnemy(source, finalDamage * 0.5, false);
    }

    this.state.update(s => {
      const newHp = Math.max(0, s.playerHp - finalDamage);
      if (newHp <= 0) {
        if (s.hasRevive) {
          return {
            ...s,
            playerHp: s.playerMaxHp * 0.5,
            hasRevive: false,
            screenShake: 20
          };
        }
        this.stopLoop();
        this.finalizeRun();
        return { ...s, playerHp: 0, status: 'gameover' };
      }
      return { ...s, playerHp: newHp, screenShake: Math.max(s.screenShake, 4) };
    });
  }

  private finalizeRun(): void {
    const s = this.state();
    const char = this.selectedCharacter();
    if (!char) return;

    const timeSurvived = (performance.now() - this.runStartTime) / 1000;

    const entry: RankingEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: Date.now(),
      characterId: char.id,
      characterName: char.name,
      characterEmoji: char.emoji,
      characterColor: char.color,
      wave: s.wave,
      kills: s.kills,
      damageDealt: s.damageDealt,
      materials: s.materials,
      money: s.money,
      diamonds: s.diamonds,
      weapons: this.currentWeapons.map(w => ({ ...w })),
      characterAbilities: char.abilities.map(a => ({ ...a })),
      specialAbilityId: s.specialAbilityId,
      ownedRareItems: [...s.ownedRareItems],
      ownedLegendaryItems: [...s.ownedLegendaryItems]
    };

    const { position, isNewRecord } = this.rankingService.submit(entry);

    const stats: RunStats = {
      characterId: char.id,
      characterName: char.name,
      characterEmoji: char.emoji,
      characterColor: char.color,
      characterAccentColor: char.accentColor,
      wave: s.wave,
      kills: s.kills,
      damageDealt: s.damageDealt,
      materials: s.materials,
      money: s.money,
      diamonds: s.diamonds,
      timeSurvived,
      weapons: this.currentWeapons.map(w => ({ ...w })),
      characterAbilities: char.abilities.map(a => ({ ...a })),
      specialAbilityId: s.specialAbilityId,
      ownedRareItems: [...s.ownedRareItems],
      ownedLegendaryItems: [...s.ownedLegendaryItems],
      rankingPosition: position,
      isNewRecord
    };

    this.lastRunStats.set(stats);
  }

  private applyRegen(dt: number): void {
    if (this.selectedCharacter()?.id === 'doctor') {
      this.healPlayer(1.0 * dt);
    }
  }

  private updateStatusEffects(dt: number): void {
    for (const e of this.enemies) {
      if (e.burnTicks && e.burnTicks > 0) e.burnTicks -= dt;
    }
  }

  private healPlayer(amount: number): void {
    this.state.update(s => {
      const newHp = Math.min(s.playerMaxHp, s.playerHp + amount);
      if (newHp > s.playerHp && amount >= 1) {
        this.particles.push({
          id: this.particleIdCounter++,
          x: this.playerX, y: this.playerY,
          vx: 0, vy: -40,
          life: 0.6, maxLife: 0.6,
          color: '#2ecc71', size: 4, kind: 'heal'
        });
      }
      return { ...s, playerHp: newHp };
    });
  }

  private spawnParticle(x: number, y: number, kind: ParticleKind): void {
    const colors: Record<ParticleKind, string> = {
      spark: '#fff', smoke: '#666', explosion: '#ff8c00',
      heal: '#2ecc71', ring: '#f1c40f', lightning: '#9b59b6',
      fire: '#ff4500', ice: '#00bfff', money: '#f1c40f',
      bossAura: '#e74c3c', diamond: '#00ffff'
    };
    this.particles.push({
      id: this.particleIdCounter++,
      x, y,
      vx: (Math.random() - 0.5) * 100,
      vy: (Math.random() - 0.5) * 100,
      life: 0.4, maxLife: 0.4,
      color: colors[kind],
      size: kind === 'explosion' ? 6 : 3,
      kind
    });
  }

  private spawnExplosion(x: number, y: number, radius: number): void {
    this.particles.push({
      id: this.particleIdCounter++,
      x, y, vx: 0, vy: 0,
      life: 0.4, maxLife: 0.4,
      color: '#ff8c00', size: radius, kind: 'explosion'
    });
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const speed = 200 + Math.random() * 200;
      this.particles.push({
        id: this.particleIdCounter++,
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5, maxLife: 0.5,
        color: i % 2 === 0 ? '#ff8c00' : '#ffd700',
        size: 4, kind: 'spark'
      });
    }
  }

  private spawnLightning(x1: number, y1: number, x2: number, y2: number): void {
    this.particles.push({
      id: this.particleIdCounter++,
      x: x1, y: y1, vx: 0, vy: 0,
      life: 0.15, maxLife: 0.15,
      color: '#9b59b6', size: 3, kind: 'lightning',
      targetX: x2, targetY: y2
    });
  }

  private spawnAbilityFx(color: string): void {
    this.particles.push({
      id: this.particleIdCounter++,
      x: this.playerX, y: this.playerY,
      vx: 0, vy: 0,
      life: 0.5, maxLife: 0.5,
      color, size: 80, kind: 'ring'
    });
    this.state.update(s => ({ ...s, screenShake: 6 }));
  }

  private spawnHealFx(): void {
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        id: this.particleIdCounter++,
        x: this.playerX + (Math.random() - 0.5) * 40,
        y: this.playerY + 20,
        vx: (Math.random() - 0.5) * 30,
        vy: -80,
        life: 0.8, maxLife: 0.8,
        color: '#2ecc71', size: 5, kind: 'heal'
      });
    }
  }

  private updateParticles(dt: number): void {
    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
      return p.life > 0;
    });
  }

  private updateDamageTexts(dt: number): void {
    this.damageTexts = this.damageTexts.filter(t => {
      t.y += t.vy * dt;
      t.lifetime -= dt;
      return t.lifetime > 0;
    });
  }

  private updateScreenShake(dt: number): void {
    const s = this.state();
    if (s.screenShake > 0) {
      this.state.update(st => ({
        ...st,
        screenShake: Math.max(0, st.screenShake - dt * 30)
      }));
    }
  }

  private generateShopWeapons(): Weapon[] {
    const pool = Object.values(WEAPONS);
    const result: Weapon[] = [];
    for (let i = 0; i < 4; i++) {
      const w = pool[Math.floor(Math.random() * pool.length)];
      result.push({ ...w });
    }
    return result;
  }

  skipShop(): void {
    this.availableWeapons.set([]);
    this.state.update(s => ({ ...s, status: 'playing' }));
    this.startLoop();
  }

  private render(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const s = this.state();

    let shakeX = 0, shakeY = 0;
    if (s.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * s.screenShake * 2;
      shakeY = (Math.random() - 0.5) * s.screenShake * 2;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(-20, -20, this.canvasWidth + 40, this.canvasHeight + 40);

    ctx.strokeStyle = this.bossState.active ? '#3a1a1a' : '#16213e';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.canvasWidth; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.canvasHeight); ctx.stroke();
    }
    for (let y = 0; y < this.canvasHeight; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.canvasWidth, y); ctx.stroke();
    }

    if (s.autoAim && this.enemies.length > 0) {
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = this.selectedCharacter()?.color ?? '#4ecdc4';
      ctx.beginPath();
      ctx.moveTo(this.playerX, this.playerY);
      ctx.arc(this.playerX, this.playerY, 140,
        this.facingAngle - Math.PI / 3, this.facingAngle + Math.PI / 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    this.renderParticles(ctx, 'behind');

    for (const p of this.diamondPickups) {
      const pulse = 1 + Math.sin(performance.now() / 150) * 0.2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(performance.now() / 500);
      ctx.beginPath();
      ctx.moveTo(0, -10 * pulse);
      ctx.lineTo(8 * pulse, 0);
      ctx.lineTo(0, 10 * pulse);
      ctx.lineTo(-8 * pulse, 0);
      ctx.closePath();
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.moneyPickups) {
      const pulse = 1 + Math.sin(performance.now() / 200) * 0.15;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#f1c40f';
      ctx.shadowColor = '#f1c40f';
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#000';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('R$', p.x, p.y);
    }

    for (const enemy of this.enemies) {
      if (enemy.isBoss) {
        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin(performance.now() / 150) * 0.15;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 15, 0, Math.PI * 2);
        ctx.fillStyle = enemy.color;
        ctx.fill();
        ctx.restore();
      }

      if (enemy.frozenUntil && performance.now() / 1000 < enemy.frozenUntil) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = '#00bfff';
        ctx.fill();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fillStyle = enemy.color;
      ctx.fill();

      if (enemy.type === 'goblin') {
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(enemy.diamondDrop && enemy.diamondDrop > 0 ? '💎' : '$', enemy.x, enemy.y);
      }

      if (enemy.isBoss) {
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👑', enemy.x, enemy.y);
      }

      const hpRatio = enemy.hp / enemy.maxHp;
      const barW = enemy.isBoss ? 60 : 30;
      ctx.fillStyle = '#333';
      ctx.fillRect(enemy.x - barW / 2, enemy.y - enemy.radius - 12, barW, enemy.isBoss ? 8 : 4);
      ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
      ctx.fillRect(enemy.x - barW / 2, enemy.y - enemy.radius - 12, barW * hpRatio, enemy.isBoss ? 8 : 4);

      if (enemy.isBoss && enemy.bossName) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(enemy.bossName, enemy.x, enemy.y - enemy.radius - 20);
      }
    }

    for (const bullet of this.bullets) {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fillStyle = bullet.color;
      ctx.shadowColor = bullet.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    this.renderParticles(ctx, 'front');

    for (const c of this.clones) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#4ecdc4';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    const isInvuln = this.buffs.invulnerableUntil > performance.now() / 1000;
    if (isInvuln) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 100) * 0.3;
      ctx.beginPath();
      ctx.arc(this.playerX, this.playerY, 22, 0, Math.PI * 2);
      ctx.fillStyle = '#f1c40f';
      ctx.fill();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(this.playerX, this.playerY, 16, 0, Math.PI * 2);
    ctx.fillStyle = this.selectedCharacter()?.color ?? '#4ecdc4';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(this.playerX, this.playerY);
    ctx.lineTo(
      this.playerX + Math.cos(this.facingAngle) * 28,
      this.playerY + Math.sin(this.facingAngle) * 28
    );
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.selectedCharacter()?.emoji ?? '🥔', this.playerX, this.playerY);

    for (const t of this.damageTexts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, t.lifetime * 1.5);
      ctx.font = t.isMoney || t.isDiamond
        ? 'bold 16px monospace'
        : (t.isCrit ? 'bold 20px monospace' : 'bold 14px monospace');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = t.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      const text = t.isDiamond ? `💎+${t.value}`
        : t.isMoney ? `+R$${t.value}`
        : (t.value === 0 ? 'ESQUIVA!' : String(t.value));
      ctx.strokeText(text, t.x, t.y);
      ctx.fillText(text, t.x, t.y);
      ctx.restore();
    }

    ctx.restore();

    this.renderHUD(ctx, s);
  }

  private renderParticles(ctx: CanvasRenderingContext2D, layer: 'front' | 'behind'): void {
    for (const p of this.particles) {
      const layerMatch =
        (layer === 'front' && (['spark', 'heal', 'lightning', 'fire', 'ice', 'money', 'bossAura', 'diamond'] as ParticleKind[]).includes(p.kind)) ||
        (layer === 'behind' && (['smoke', 'explosion', 'ring'] as ParticleKind[]).includes(p.kind));
      if (!layerMatch) continue;

      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.kind === 'ring') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.2 - alpha) * 2, 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (p.kind === 'explosion') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.2 - alpha), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.6;
        ctx.fill();
      } else if (p.kind === 'lightning' && p.targetX !== undefined && p.targetY !== undefined) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        const steps = 5;
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const mx = p.x + (p.targetX - p.x) * t + (Math.random() - 0.5) * 15;
          const my = p.y + (p.targetY - p.y) * t + (Math.random() - 0.5) * 15;
          ctx.lineTo(mx, my);
        }
        ctx.lineTo(p.targetX, p.targetY);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D, s: GameState): void {
    const hpRatio = s.playerHp / s.playerMaxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(10, 10, 200, 20);
    ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(10, 10, 200 * hpRatio, 20);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 200, 20);

    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(s.playerHp)}/${Math.ceil(s.playerMaxHp)}`, 16, 20);

    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Onda ${s.wave}`, this.canvasWidth - 20, 20);
    ctx.fillText(`⏱ ${Math.ceil(s.timeLeft)}s`, this.canvasWidth - 20, 45);

    const prog = 1 - (s.timeLeft / s.waveDuration);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(this.canvasWidth - 200, 60, 180, 6);
    ctx.fillStyle = '#4ecdc4';
    ctx.fillRect(this.canvasWidth - 200, 60, 180 * prog, 6);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`💎 ${s.materials}`, 10, 55);

    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`R$ ${s.money}`, 10, 78);

    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`💠 ${s.diamonds}`, 10, 100);

    ctx.font = '20px sans-serif';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < this.currentWeapons.length; i++) {
      ctx.fillText(this.currentWeapons[i].icon, 16 + i * 28, 128);
    }

    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = s.autoAim ? '#2ecc71' : '#e74c3c';
    ctx.fillText(s.autoAim ? '● AUTO' : '○ MANUAL [ESPAÇO]', 10, 158);

    const char = this.selectedCharacter();
    let hudY = 175;
    if (char) {
      const activeAb = char.abilities.find(a => a.trigger === 'active');
      if (activeAb) {
        const cd = s.abilityCooldowns[activeAb.id] ?? 0;
        const ready = cd <= 0;
        ctx.fillStyle = ready ? 'rgba(78,205,196,0.8)' : 'rgba(100,100,100,0.6)';
        ctx.fillRect(10, hudY, 180, 20);
        ctx.strokeStyle = ready ? '#4ecdc4' : '#666';
        ctx.lineWidth = 1;
        ctx.strokeRect(10, hudY, 180, 20);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(
          ready ? `[Q] ${activeAb.icon} ${activeAb.name}`
                : `[Q] ${activeAb.icon} ${activeAb.name} (${cd.toFixed(1)}s)`,
          16, hudY + 10
        );
        hudY += 24;
      }
    }

    if (s.specialAbilityId) {
      const ability = SPECIAL_ABILITIES.find(a => a.id === s.specialAbilityId);
      if (ability) {
        const ready = s.specialAbilityCooldown <= 0;
        ctx.fillStyle = ready ? 'rgba(241,196,15,0.85)' : 'rgba(100,100,100,0.6)';
        ctx.fillRect(10, hudY, 180, 20);
        ctx.strokeStyle = ready ? '#f1c40f' : '#666';
        ctx.lineWidth = 1;
        ctx.strokeRect(10, hudY, 180, 20);
        ctx.fillStyle = '#0f0f1a';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(
          ready ? `[E] ${ability.icon} ${ability.name}`
                : `[E] ${ability.icon} ${ability.name} (${s.specialAbilityCooldown.toFixed(1)}s)`,
          16, hudY + 10
        );
      }
    }

    const now = performance.now() / 1000;
    const buffs: string[] = [];
    if (this.buffs.critBoostUntil > now) buffs.push('🎯');
    if (this.buffs.cadenceBoostUntil > now) buffs.push('⚡');
    if (this.buffs.damageBoostUntil > now) buffs.push('😡');
    if (this.buffs.speedBoostUntil > now) buffs.push('💨');
    if (this.buffs.invulnerableUntil > now) buffs.push('🛡️');
    if (this.buffs.berserkUntil > now) buffs.push('🔥');

    if (buffs.length > 0) {
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f1c40f';
      ctx.fillText(buffs.join(' '), this.canvasWidth / 2, 30);
    }

    if (this.bossState.active && this.bossState.name) {
      ctx.save();
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e74c3c';
      ctx.shadowColor = '#e74c3c';
      ctx.shadowBlur = 20;
      ctx.fillText(`⚔ ${this.bossState.name} ⚔`, this.canvasWidth / 2, 70);
      ctx.restore();
    }
  }

  private drawMenuBackground(): void {
    if (!this.ctx) return;
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.ctx.fillStyle = '#4ecdc4';
    this.ctx.font = 'bold 48px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('PERSONATO', this.canvasWidth / 2, this.canvasHeight / 2);
    this.ctx.fillStyle = '#888';
    this.ctx.font = '18px sans-serif';
    this.ctx.fillText('Escolha seu personagem para começar', this.canvasWidth / 2, this.canvasHeight / 2 + 50);
  }

  restart(): void {
    this.stopLoop();
    this.enemies = [];
    this.bullets = [];
    this.damageTexts = [];
    this.particles = [];
    this.moneyPickups = [];
    this.diamondPickups = [];
    this.clones = [];
    this.availableWeapons.set([]);
    this.selectedCharacter.set(null);
    this.lastRunStats.set(null);
    this.bossState = { active: false, name: '', level: 0, abilityCooldown: 0 };
    this.maxWeaponSlots = 5;
    const dur1 = GameEngineService.waveDuration(1);
    this.state.set({
      status: 'menu',
      wave: 1, timeLeft: dur1, waveDuration: dur1,
      materials: 0, money: 0, diamonds: 0,
      playerHp: 30, playerMaxHp: 30,
      kills: 0, damageDealt: 0, autoAim: true,
      abilityCooldowns: {},
      specialAbilityId: null,
      specialAbilityCooldown: 0,
      ownedRareItems: [],
      ownedLegendaryItems: [],
      upgrades: { ...this.defaultUpgrades },
      hasRevive: false,
      screenShake: 0,
      bossActive: false,
      pausedFrom: undefined
    });
    this.drawMenuBackground();
  }

  getWaveDuration(wave: number): number {
    return GameEngineService.waveDuration(wave);
  }

  getSpecialAbilities() { return SPECIAL_ABILITIES; }
  getRareItems() { return RARE_ITEMS; }
  getLegendaryItems() { return LEGENDARY_ITEMS; }
  getUpgrades() { return UPGRADES; }
  getCurrentWeapons(): Weapon[] { return this.currentWeapons; }

  // ═════════════════════════════════════════════════════════
  // CONTROLES TOUCH (JOYSTICK VIRTUAL)
  // ═════════════════════════════════════════════════════════

  /**
   * Aplica input do joystick virtual como se fosse WASD.
   * dx/dy normalizados (-1 a 1).
   */
  setMoveInput(dx: number, dy: number): void {
    // Aplica na "keys" simulando WASD com uma zona morta de 0.3
    this.keys['w'] = dy < -0.3;
    this.keys['s'] = dy > 0.3;
    this.keys['a'] = dx < -0.3;
    this.keys['d'] = dx > 0.3;

    // Atualiza a direção de mira com o mesmo vetor
    const magnitude = Math.hypot(dx, dy);
    if (magnitude > 0.3) {
      this.facingAngle = Math.atan2(dy, dx);
    }
  }

  /**
   * Limpa o input do joystick (dedo levantado da tela).
   */
  clearMoveInput(): void {
    this.keys['w'] = false;
    this.keys['s'] = false;
    this.keys['a'] = false;
    this.keys['d'] = false;
  }

  /**
   * Dispara a habilidade Q (chamada pelo botão touch).
   */
  triggerAbilityQ(): void {
    this.useActiveAbility('Q');
  }

  /**
   * Dispara a habilidade especial E (chamada pelo botão touch).
   */
  triggerAbilityE(): void {
    this.useSpecialAbility();
  }

  /**
   * Alterna auto-aim (chamado pelo botão touch).
   */
  toggleAutoAimPublic(): void {
    this.toggleAutoAim();
  }
}
