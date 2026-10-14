import {
  Component, inject, viewChild, ElementRef, afterNextRender
} from '@angular/core';
import { GameEngineService } from './services/game-engine.service';
import {
  CHARACTERS, SPECIAL_ABILITIES, RARE_ITEMS,
  LEGENDARY_ITEMS, UPGRADES
} from './data/characters';
import {
  Character, Weapon, SpecialAbilityId, RareItemId,
  LegendaryItemId, UpgradeId
} from './models/character.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [],
  template: `
    <div class="game-container">

      <!-- MENU -->
      @if (state().status === 'menu') {
        <div class="menu-screen">
          <h1 class="title">PERSONATO</h1>
          <p class="subtitle">Sobreviva a ondas infinitas. Colete diamantes. Torne-se uma lenda.</p>
          <div class="character-grid">
            @for (char of characters; track char.id) {
              <div
                class="character-card"
                [style.border-color]="char.color"
                [style.--accent]="char.accentColor"
                (click)="selectCharacter(char)"
              >
                <div class="char-header">
                  <div class="char-emoji" [style.background]="char.color + '22'">
                    {{ char.emoji }}
                  </div>
                  <div class="char-name" [style.color]="char.color">{{ char.name }}</div>
                </div>
                <div class="char-lore">"{{ char.lore }}"</div>
                <div class="char-desc">{{ char.description }}</div>
                <div class="abilities">
                  @for (ab of char.abilities; track ab.id) {
                    <div class="ability" [class.active]="ab.trigger === 'active'" [title]="ab.description">
                      <span class="ability-icon">{{ ab.icon }}</span>
                      <span class="ability-name">
                        @if (ab.trigger === 'active') { [{{ ab.key }}] }
                        {{ ab.name }}
                      </span>
                      <span class="ability-desc">{{ ab.description }}</span>
                    </div>
                  }
                </div>
                <div class="char-weapons">
                  @for (w of char.startingWeapons; track $index) {
                    <span class="weapon-badge" [style.background]="w.color">{{ w.icon }}</span>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <div class="canvas-wrapper" [class.hidden]="state().status === 'menu'">
        <canvas #gameCanvas class="game-canvas"></canvas>
      </div>

      <!-- LOJA PADRÃO -->
      @if (state().status === 'shop') {
        <div class="shop-overlay">
          <h2>🛒 Loja — Onda {{ state().wave }}</h2>

          <div class="resources-bar">
            <span class="resource materials">💎 {{ state().materials }}</span>
            <span class="resource money">💰 R$ {{ state().money }}</span>
            <span class="resource diamonds">💠 {{ state().diamonds }}</span>
          </div>

          <p class="wave-info">⏱ Próxima onda: <strong>{{ state().timeLeft }}s</strong></p>

          @if (state().wave % 10 === 0) {
            <p class="boss-warning">⚠️ A PRÓXIMA ONDA É DE BOSS ⚠️</p>
          }

          <!-- MINHAS ARMAS -->
          <div class="my-weapons">
            <div class="my-weapons-title">
              🎒 Suas Armas ({{ getCurrentWeapons().length }}/{{ getMaxWeaponSlots() }})
            </div>
            <div class="my-weapons-list">
              @for (w of getCurrentWeapons(); track $index) {
                <div class="my-weapon-slot" [style.border-color]="w.color">
                  <span class="my-weapon-icon">{{ w.icon }}</span>
                  <span class="my-weapon-name">{{ w.name }}</span>
                  <button class="sell-btn" (click)="sellWeapon($index)" title="Vender">
                    ×
                  </button>
                </div>
              }
            </div>
          </div>

          <div class="shop-items">
            @for (weapon of availableWeapons(); track $index) {
              <div
                class="shop-item"
                [style.border-color]="weapon.color"
                (click)="buyWeapon(weapon)"
              >
                <div class="weapon-icon">{{ weapon.icon }}</div>
                <div class="weapon-name">{{ weapon.name }}</div>
                <div class="weapon-behavior">{{ getBehaviorLabel(weapon) }}</div>
                <div class="weapon-stats">
                  <span>{{ weapon.type === 'melee' ? 'Melee' : 'Distância' }}</span>
                  <span>Dano {{ weapon.damage }}</span>
                  @if (weapon.projectiles && weapon.projectiles > 1) {
                    <span>{{ weapon.projectiles }}x projéteis</span>
                  }
                  @if (weapon.pierce && weapon.pierce > 0) {
                    <span>Atravessa {{ weapon.pierce }}</span>
                  }
                  @if (weapon.explosionRadius) {
                    <span>💥 Área {{ weapon.explosionRadius }}</span>
                  }
                  @if (weapon.chainCount) {
                    <span>⚡ Corrente {{ weapon.chainCount }}</span>
                  }
                </div>
                <div class="weapon-price">💎 {{ getWeaponCost() }}</div>
              </div>
            }
          </div>

          <div class="shop-actions">
            <button class="btn-market" (click)="openBlackMarket()">
              🕶️ Mercado Negro
            </button>
            <button class="btn-legendary" (click)="openLegendaryShop()">
              💠 Loja Lendária
            </button>
            <button class="btn-secondary" (click)="pauseGame()">⏸ [ESC]</button>
            <button class="btn-continue" (click)="skipShop()">Continuar →</button>
          </div>
        </div>
      }

      <!-- SUBSTITUIR ARMA -->
      @if (state().status === 'replaceWeapon' && state().pendingWeapon) {
        <div class="replace-overlay">
          <h2>🔫 Substituir Arma</h2>
          <p class="replace-info">
            Você tem {{ getCurrentWeapons().length }} armas (máx {{ getMaxWeaponSlots() }}).
            Escolha qual substituir por <strong>{{ state().pendingWeapon!.name }}</strong>.
          </p>

          <div class="replace-grid">
            <div
              class="replace-slot"
              [style.border-color]="state().pendingWeapon!.color"
              (click)="confirmReplace(-1)"
            >
              <div class="replace-icon">➕</div>
              <div class="replace-name">Adicionar</div>
              <div class="replace-hint">Se vender a arma antiga</div>
            </div>

            @for (w of getCurrentWeapons(); track $index) {
              <div
                class="replace-slot replace-slot-current"
                [style.border-color]="w.color"
                (click)="confirmReplace($index)"
              >
                <div class="replace-icon">{{ w.icon }}</div>
                <div class="replace-name">{{ w.name }}</div>
                <div class="replace-hint">
                  Dano {{ w.damage }} • {{ getBehaviorLabel(w) }}
                </div>
              </div>
            }
          </div>

          <div class="shop-actions">
            <button class="btn-secondary" (click)="cancelReplace()">Cancelar</button>
          </div>
        </div>
      }

      <!-- MERCADO NEGRO -->
      @if (state().status === 'blackMarket') {
        <div class="market-overlay">
          <h2 class="market-title">🕶️ Mercado Negro</h2>
          <div class="resources-bar">
            <span class="resource money big">💰 R$ {{ state().money }}</span>
          </div>

          <!-- UPGRADES -->
          <div class="market-section">
            <h3>📈 Upgrades (custo aumenta a cada nível)</h3>
            <p class="section-hint">Use R$ para evoluir permanentemente seus atributos.</p>
            <div class="upgrade-grid">
              @for (up of upgrades; track up.id) {
                <div
                  class="upgrade-item"
                  [class.maxed]="isUpgradeMaxed(up.id)"
                  [class.affordable]="state().money >= getUpgradePrice(up.id) && !isUpgradeMaxed(up.id)"
                  (click)="buyUpgrade(up.id)"
                >
                  <div class="upgrade-icon">{{ up.icon }}</div>
                  <div class="upgrade-info">
                    <div class="upgrade-name">{{ up.name }}</div>
                    <div class="upgrade-level">
                      Nv. {{ getUpgradeLevel(up.id) }}/{{ up.maxLevel }}
                    </div>
                    <div class="upgrade-effect">{{ up.unit }} por nível</div>
                  </div>
                  <div class="upgrade-btn">
                    @if (isUpgradeMaxed(up.id)) {
                      <span class="maxed-text">MÁX</span>
                    } @else {
                      <span class="plus">＋</span>
                      <span class="price-small">R$ {{ getUpgradePrice(up.id) }}</span>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- ITENS RAROS -->
          <div class="market-section">
            <h3>💎 Itens Raros (R$)</h3>
            <div class="market-grid">
              @for (item of rareItems; track item.id) {
                <div
                  class="market-item rare-item"
                  [class.owned]="isOwned(item.id)"
                  [class.affordable]="state().money >= item.price && !isOwned(item.id)"
                  (click)="buyRareItem(item.id)"
                >
                  <div class="market-icon">{{ item.icon }}</div>
                  <div class="market-name">{{ item.name }}</div>
                  <div class="market-desc">{{ item.description }}</div>
                  <div class="market-footer">
                    @if (isOwned(item.id)) {
                      <span class="owned-badge">✓ Comprado</span>
                    } @else {
                      <span class="price">R$ {{ item.price }}</span>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- HABILIDADES ESPECIAIS -->
          <div class="market-section">
            <h3>⚡ Habilidade Especial (tecla E)</h3>
            <div class="market-grid">
              @for (ability of specialAbilities; track ability.id) {
                <div
                  class="market-item ability-item"
                  [class.equipped]="state().specialAbilityId === ability.id"
                  [class.affordable]="state().money >= ability.price"
                  (click)="buySpecialAbility(ability.id)"
                >
                  <div class="market-icon">{{ ability.icon }}</div>
                  <div class="market-name">{{ ability.name }}</div>
                  <div class="market-desc">{{ ability.description }}</div>
                  <div class="market-footer">
                    <span class="cooldown">⏱ {{ ability.cooldown }}s</span>
                    <span class="price">R$ {{ ability.price }}</span>
                  </div>
                  @if (state().specialAbilityId === ability.id) {
                    <div class="equipped-badge">✓</div>
                  }
                </div>
              }
            </div>
          </div>

          <div class="shop-actions">
            <button class="btn-secondary" (click)="closeBlackMarket()">← Voltar</button>
          </div>
        </div>
      }

      <!-- LOJA LENDÁRIA (DIAMANTES) -->
      @if (state().status === 'legendaryShop') {
        <div class="legendary-overlay">
          <h2 class="legendary-title">💠 Loja Lendária</h2>
          <div class="resources-bar">
            <span class="resource diamonds big">💠 {{ state().diamonds }} Diamantes</span>
          </div>
          <p class="legendary-subtitle">
            Itens exclusivos obtidos apenas com diamantes de bosses e goblins raros.
          </p>

          <div class="legendary-grid">
            @for (item of legendaryItems; track item.id) {
              <div
                class="legendary-item"
                [class.owned]="isOwnedLegendary(item.id)"
                [class.affordable]="state().diamonds >= item.price && !isOwnedLegendary(item.id)"
                (click)="buyLegendaryItem(item.id)"
              >
                <div class="legendary-glow"></div>
                <div class="legendary-icon">{{ item.icon }}</div>
                <div class="legendary-name">{{ item.name }}</div>
                <div class="legendary-desc">{{ item.description }}</div>
                <div class="legendary-footer">
                  @if (isOwnedLegendary(item.id)) {
                    <span class="owned-badge-legendary">✓ Adquirido</span>
                  } @else {
                    <span class="diamond-price">💠 {{ item.price }}</span>
                  }
                </div>
              </div>
            }
          </div>

          <div class="shop-actions">
            <button class="btn-secondary" (click)="closeLegendaryShop()">← Voltar</button>
          </div>
        </div>
      }

      <!-- PAUSE -->
      @if (state().status === 'paused') {
        <div class="pause-overlay">
          <h1 class="pause-title">⏸ PAUSADO</h1>
          <p class="pause-info">Onda {{ state().wave }} — ⏱ {{ Math.ceil(state().timeLeft) }}s</p>
          <div class="pause-stats">
            <div class="stat">
              <div class="stat-value">{{ state().kills }}</div>
              <div class="stat-label">Kills</div>
            </div>
            <div class="stat">
              <div class="stat-value">{{ state().damageDealt }}</div>
              <div class="stat-label">Dano</div>
            </div>
            <div class="stat">
              <div class="stat-value money">R$ {{ state().money }}</div>
              <div class="stat-label">Dinheiro</div>
            </div>
            <div class="stat">
              <div class="stat-value diamonds">💠 {{ state().diamonds }}</div>
              <div class="stat-label">Diamantes</div>
            </div>
          </div>
          <div class="pause-buttons">
            <button class="btn-continue" (click)="resumeGame()">▶ Continuar</button>
            <button class="btn-secondary" (click)="quitToMenu()">🏠 Menu Principal</button>
          </div>
          <p class="pause-hint">ESC para continuar</p>
        </div>
      }

      <!-- GAME OVER -->
      @if (state().status === 'gameover') {
        <div class="overlay">
          <h1 class="gameover-title">💀 Derrota</h1>
          <p>Onda alcançada: {{ state().wave }}</p>
          <p>Inimigos derrotados: {{ state().kills }}</p>
          <p>Dano total: {{ state().damageDealt }}</p>
          <p class="money-summary">💰 R$ {{ state().money }} • 💠 {{ state().diamonds }} diamantes</p>
          <button class="btn-restart" (click)="restart()">Jogar de novo</button>
        </div>
      }

    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; min-height: 100vh; }

    .game-container {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      width: 100%; min-height: 100vh;
      padding: clamp(12px, 2vw, 32px);
    }

    /* MENU */
    .menu-screen {
      display: flex; flex-direction: column; align-items: center;
      width: 100%; max-width: min(1400px, 100%);
    }
    .title {
      font-size: clamp(36px, 6vw, 72px); font-weight: 900;
      background: linear-gradient(135deg, #4ecdc4, #f39c12, #ff69b4);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0 0 8px 0; letter-spacing: clamp(2px, 0.6vw, 6px); text-align: center;
    }
    .subtitle {
      color: #888; margin: 0 0 clamp(20px, 3vh, 36px) 0;
      font-size: clamp(12px, 1.2vw, 16px); text-align: center; padding: 0 12px;
    }
    .character-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: clamp(10px, 1.4vw, 18px); width: 100%; max-width: 1280px;
    }
    .character-card {
      background: linear-gradient(160deg, #1a1a2e 0%, #16162a 100%);
      border: 2px solid #333; border-radius: 14px;
      padding: clamp(12px, 1.2vw, 18px); cursor: pointer;
      transition: transform 0.25s, box-shadow 0.25s;
      display: flex; flex-direction: column; min-height: 300px;
      position: relative; overflow: hidden;
    }
    .character-card::before {
      content: ''; position: absolute; inset: 0;
      background: radial-gradient(circle at top right, var(--accent), transparent 60%);
      opacity: 0.12; pointer-events: none;
    }
    .character-card:hover {
      transform: translateY(-6px) scale(1.02);
      box-shadow: 0 12px 32px rgba(78, 205, 196, 0.2);
    }
    .char-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .char-emoji {
      font-size: clamp(24px, 2.4vw, 34px);
      width: clamp(42px, 4vw, 54px); height: clamp(42px, 4vw, 54px);
      display: flex; align-items: center; justify-content: center;
      border-radius: 10px;
    }
    .char-name { font-size: clamp(15px, 1.4vw, 19px); font-weight: 800; }
    .char-lore { font-size: 11px; color: #666; font-style: italic; margin-bottom: 8px; }
    .char-desc { font-size: 12px; color: #aaa; margin-bottom: 12px; }
    .abilities { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .ability {
      background: #23233a; border-radius: 6px; padding: 6px 8px;
      font-size: 10.5px; color: #ccc;
      display: flex; align-items: center; gap: 6px;
      border-left: 3px solid #444;
    }
    .ability.active { border-left-color: #f39c12; background: #2a2a18; }
    .ability-icon { font-size: 14px; flex-shrink: 0; }
    .ability-name { font-weight: 700; white-space: nowrap; }
    .ability-desc { color: #777; font-size: 9.5px; margin-left: auto; text-align: right; max-width: 60%; }
    .char-weapons { display: flex; gap: 6px; margin-top: auto; }
    .weapon-badge {
      width: 30px; height: 30px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center; font-size: 16px;
    }

    /* CANVAS */
    .canvas-wrapper {
      display: flex; align-items: center; justify-content: center;
      width: 100%; padding: clamp(8px, 1.5vw, 24px);
    }
    .canvas-wrapper.hidden { display: none; }
    .game-canvas {
      border: 2px solid #333; border-radius: 8px;
      box-shadow: 0 0 40px rgba(78, 205, 196, 0.1);
      display: block;
      width: min(100%, calc((100vh - 80px) * (4 / 3)));
      height: auto; aspect-ratio: 4 / 3;
      max-height: calc(100vh - 80px);
    }

    /* OVERLAYS */
    .shop-overlay, .overlay, .pause-overlay, .market-overlay,
    .legendary-overlay, .replace-overlay {
      position: fixed; inset: 0;
      background: rgba(15, 15, 26, 0.96);
      display: flex; flex-direction: column;
      align-items: center; justify-content: flex-start;
      z-index: 10; gap: clamp(8px, 1.2vh, 14px);
      padding: clamp(16px, 3vw, 40px);
      overflow-y: auto;
    }
    .pause-overlay { justify-content: center; backdrop-filter: blur(6px); }
    .legendary-overlay {
      background: linear-gradient(180deg, #0a0520 0%, #150a30 100%);
    }
    .replace-overlay { justify-content: center; background: rgba(5, 5, 15, 0.98); }

    .market-title {
      font-size: clamp(22px, 3vw, 34px); margin: 0;
      background: linear-gradient(135deg, #8e44ad, #f1c40f);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent; text-align: center;
    }
    .legendary-title {
      font-size: clamp(26px, 3.4vw, 42px); margin: 0;
      background: linear-gradient(135deg, #00ffff, #8e44ad, #f1c40f);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent; text-align: center;
      text-shadow: 0 0 40px rgba(0, 255, 255, 0.3);
      letter-spacing: 3px; font-weight: 900;
    }
    .legendary-subtitle {
      color: #7a6a9a; font-size: clamp(11px, 1vw, 14px);
      text-align: center; margin: 0; font-style: italic;
    }

    .resources-bar {
      display: flex; gap: 14px; align-items: center;
      flex-wrap: wrap; justify-content: center;
    }
    .resource {
      font-size: clamp(14px, 1.3vw, 18px); font-weight: bold;
      padding: 6px 14px; border-radius: 6px;
      background: #1a1a2e; border: 1px solid #333;
    }
    .resource.materials { color: #4ecdc4; }
    .resource.money { color: #2ecc71; }
    .resource.diamonds { color: #00ffff; }
    .resource.money.big, .resource.diamonds.big {
      font-size: clamp(16px, 1.6vw, 22px);
      padding: 8px 18px;
    }
    .resource.diamonds.big {
      background: linear-gradient(135deg, #0a0520, #1a1040);
      border-color: #00ffff;
      box-shadow: 0 0 20px rgba(0, 255, 255, 0.2);
    }

    .wave-info { color: #4ecdc4; font-size: clamp(12px, 1.1vw, 14px); margin: 0; }
    .boss-warning {
      color: #e74c3c; font-weight: bold;
      font-size: clamp(13px, 1.2vw, 16px);
      animation: pulse 1.5s infinite; margin: 0;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

    /* MINHAS ARMAS */
    .my-weapons {
      background: rgba(30, 30, 50, 0.6);
      border: 1px solid #333; border-radius: 10px;
      padding: 10px 16px; max-width: 900px;
      width: 100%;
    }
    .my-weapons-title {
      font-size: 13px; color: #4ecdc4; font-weight: bold;
      margin-bottom: 8px; letter-spacing: 1px;
    }
    .my-weapons-list {
      display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;
    }
    .my-weapon-slot {
      background: #1a1a2e; border: 2px solid #333;
      border-radius: 8px; padding: 6px 10px;
      display: flex; align-items: center; gap: 6px;
      position: relative; font-size: 12px;
    }
    .my-weapon-icon { font-size: 18px; }
    .my-weapon-name { color: #ccc; font-weight: 600; }
    .sell-btn {
      background: rgba(231, 76, 60, 0.3);
      border: 1px solid #e74c3c; color: #e74c3c;
      width: 20px; height: 20px; border-radius: 50%;
      cursor: pointer; font-size: 12px; font-weight: bold;
      display: flex; align-items: center; justify-content: center;
      padding: 0; line-height: 1;
    }
    .sell-btn:hover { background: #e74c3c; color: #fff; }

    /* SHOP ITEMS */
    .shop-items {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 220px));
      gap: clamp(10px, 1.4vw, 18px); margin: 10px 0;
      justify-content: center; width: 100%; max-width: 1000px;
    }
    .shop-item {
      background: #1a1a2e; border: 2px solid #333; border-radius: 10px;
      padding: clamp(12px, 1.2vw, 16px); cursor: pointer;
      text-align: center; transition: transform 0.15s;
      min-height: 200px; display: flex; flex-direction: column;
    }
    .shop-item:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 20px rgba(255, 255, 255, 0.15);
    }
    .weapon-icon { font-size: clamp(24px, 2.8vw, 34px); margin-bottom: 8px; }
    .weapon-name { font-weight: bold; margin-bottom: 4px; }
    .weapon-behavior {
      font-size: 10px; color: #4ecdc4;
      text-transform: uppercase; letter-spacing: 1px;
    }
    .weapon-stats {
      font-size: 11px; color: #888;
      display: flex; flex-direction: column; gap: 2px; flex: 1;
    }
    .weapon-price { margin-top: 10px; color: #f1c40f; font-weight: bold; }

    .shop-actions, .pause-buttons {
      display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;
    }

    /* MARKET / UPGRADES */
    .market-sections, .market-section {
      display: flex; flex-direction: column;
      gap: 10px; width: 100%; max-width: 1100px;
    }
    .market-section h3 {
      font-size: clamp(14px, 1.3vw, 18px);
      color: #f1c40f; margin: 0;
    }
    .section-hint {
      font-size: clamp(10px, 0.9vw, 12px);
      color: #666; margin: 0 0 8px 0;
    }
    .market-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 10px;
    }
    .market-item {
      background: #1a1a2e; border: 2px solid #333;
      border-radius: 10px; padding: 12px; cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      position: relative;
      display: flex; flex-direction: column; gap: 6px;
    }
    .market-item.affordable:hover {
      transform: scale(1.03);
      box-shadow: 0 0 20px rgba(241, 196, 15, 0.3);
      border-color: #f1c40f;
    }
    .market-item.equipped { border-color: #f1c40f; background: #2a2a18; }
    .market-item.owned {
      border-color: #2ecc71; background: #1a2a1f;
      cursor: default; opacity: 0.75;
    }
    .market-item:not(.affordable):not(.equipped):not(.owned) {
      opacity: 0.45; cursor: not-allowed;
    }
    .ability-item { border-left: 4px solid #f1c40f; }
    .rare-item { border-left: 4px solid #8e44ad; }

    .market-icon { font-size: 28px; }
    .market-name { font-weight: bold; font-size: 13px; }
    .market-desc { font-size: 11px; color: #999; flex: 1; }
    .market-footer {
      display: flex; justify-content: space-between; align-items: center;
    }
    .price { color: #f1c40f; font-weight: bold; font-size: 13px; }
    .cooldown { color: #666; font-size: 11px; }

    .equipped-badge, .owned-badge {
      position: absolute; top: 6px; right: 6px;
      color: #0f0f1a; font-size: 9px; font-weight: bold;
      padding: 2px 6px; border-radius: 4px;
    }
    .equipped-badge { background: #f1c40f; }
    .owned-badge { background: #2ecc71; }

    /* UPGRADES */
    .upgrade-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
    }
    .upgrade-item {
      background: linear-gradient(160deg, #1a1a2e, #221a2e);
      border: 2px solid #333; border-radius: 10px;
      padding: 10px 12px; cursor: pointer;
      display: flex; align-items: center; gap: 10px;
      transition: all 0.15s;
    }
    .upgrade-item.affordable:hover {
      border-color: #2ecc71;
      box-shadow: 0 0 18px rgba(46, 204, 113, 0.25);
      transform: scale(1.02);
    }
    .upgrade-item.maxed {
      opacity: 0.55; cursor: default;
      border-color: #f1c40f;
    }
    .upgrade-item:not(.affordable):not(.maxed) {
      opacity: 0.5; cursor: not-allowed;
    }
    .upgrade-icon { font-size: 28px; flex-shrink: 0; }
    .upgrade-info { flex: 1; min-width: 0; }
    .upgrade-name { font-weight: bold; font-size: 13px; color: #eee; }
    .upgrade-level { font-size: 11px; color: #4ecdc4; margin-top: 2px; }
    .upgrade-effect { font-size: 10px; color: #666; margin-top: 2px; }
    .upgrade-btn {
      display: flex; flex-direction: column;
      align-items: center; gap: 2px; flex-shrink: 0;
      min-width: 60px;
    }
    .plus {
      font-size: 22px; font-weight: bold;
      color: #2ecc71; line-height: 1;
    }
    .maxed-text {
      color: #f1c40f; font-weight: bold;
      font-size: 12px; letter-spacing: 1px;
    }
    .price-small {
      font-size: 11px; color: #f1c40f;
      font-weight: bold; white-space: nowrap;
    }

    /* LOJA LENDÁRIA */
    .legendary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 14px;
      width: 100%; max-width: 1100px;
      padding: 10px;
    }
    .legendary-item {
      background: linear-gradient(160deg, #0f0a25 0%, #1a1040 100%);
      border: 2px solid #2a1a4a; border-radius: 12px;
      padding: 16px; cursor: pointer;
      position: relative; overflow: hidden;
      display: flex; flex-direction: column; gap: 8px;
      transition: all 0.2s;
    }
    .legendary-item.affordable:hover {
      border-color: #00ffff;
      box-shadow: 0 0 30px rgba(0, 255, 255, 0.4);
      transform: scale(1.03) translateY(-3px);
    }
    .legendary-item.owned {
      border-color: #2ecc71;
      box-shadow: 0 0 20px rgba(46, 204, 113, 0.3);
      cursor: default;
    }
    .legendary-item:not(.affordable):not(.owned) {
      opacity: 0.5; cursor: not-allowed;
    }
    .legendary-glow {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 50% 0%, rgba(0, 255, 255, 0.15), transparent 70%);
      pointer-events: none;
    }
    .legendary-icon {
      font-size: 40px; text-align: center;
      filter: drop-shadow(0 0 10px rgba(0, 255, 255, 0.5));
    }
    .legendary-name {
      font-weight: 900; font-size: 15px;
      color: #fff; text-align: center;
      text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
      letter-spacing: 0.5px;
    }
    .legendary-desc {
      font-size: 11.5px; color: #b0a0d0;
      text-align: center; flex: 1; line-height: 1.4;
    }
    .legendary-footer {
      display: flex; justify-content: center;
      align-items: center; padding-top: 8px;
      border-top: 1px solid rgba(0, 255, 255, 0.15);
    }
    .diamond-price {
      color: #00ffff; font-weight: 900;
      font-size: 17px;
      text-shadow: 0 0 8px rgba(0, 255, 255, 0.6);
    }
    .owned-badge-legendary {
      color: #2ecc71; font-weight: bold;
      font-size: 12px; letter-spacing: 1px;
    }

    /* REPLACE WEAPON */
    .replace-grid {
      display: flex; gap: 12px; flex-wrap: wrap;
      justify-content: center; max-width: 1000px;
      margin: 10px 0;
    }
    .replace-slot {
      background: #1a1a2e; border: 2px dashed #444;
      border-radius: 10px; padding: 14px 18px;
      cursor: pointer; transition: all 0.15s;
      min-width: 130px; text-align: center;
    }
    .replace-slot:hover {
      border-color: #f1c40f; background: #2a2a1a;
      transform: scale(1.05);
    }
    .replace-icon { font-size: 32px; margin-bottom: 6px; }
    .replace-name { font-weight: bold; font-size: 13px; color: #eee; }
    .replace-hint { font-size: 10px; color: #777; margin-top: 4px; }

    /* PAUSE */
    .pause-title {
      font-size: clamp(36px, 5vw, 64px); font-weight: 900;
      color: #4ecdc4; margin: 0; letter-spacing: 4px;
      text-shadow: 0 0 30px rgba(78, 205, 196, 0.5);
    }
    .pause-info { font-size: clamp(14px, 1.3vw, 18px); color: #aaa; margin: 0; }
    .pause-stats {
      display: flex; gap: clamp(20px, 4vw, 60px);
      margin: clamp(16px, 2vh, 28px) 0;
      flex-wrap: wrap; justify-content: center;
    }
    .stat { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .stat-value {
      font-size: clamp(24px, 3vw, 40px); font-weight: 900;
      color: #f1c40f; font-family: monospace;
    }
    .stat-value.money { color: #2ecc71; }
    .stat-value.diamonds { color: #00ffff; }
    .stat-label {
      font-size: 11px; color: #666;
      text-transform: uppercase; letter-spacing: 1.5px;
    }
    .pause-hint { color: #444; font-size: 12px; font-style: italic; }

    /* BOTÕES */
    .btn-continue, .btn-restart, .btn-secondary, .btn-market, .btn-legendary {
      border: none; border-radius: 8px; font-weight: bold;
      cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
      font-family: inherit;
      padding: clamp(10px, 1.2vh, 14px) clamp(20px, 2.4vw, 32px);
      font-size: clamp(13px, 1.2vw, 16px);
    }
    .btn-continue, .btn-restart {
      background: linear-gradient(135deg, #4ecdc4, #2ecc71);
      color: #0f0f1a;
    }
    .btn-secondary {
      background: #2a2a45; color: #ccc; border: 2px solid #3a3a55;
    }
    .btn-market {
      background: linear-gradient(135deg, #8e44ad, #f1c40f);
      color: #0f0f1a;
    }
    .btn-legendary {
      background: linear-gradient(135deg, #00ffff, #8e44ad);
      color: #0f0f1a;
      box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
    }
    .btn-continue:hover, .btn-restart:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 20px rgba(78, 205, 196, 0.4);
    }
    .btn-secondary:hover { transform: scale(1.05); background: #3a3a55; }
    .btn-market:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 20px rgba(241, 196, 15, 0.4);
    }
    .btn-legendary:hover {
      transform: scale(1.05);
      box-shadow: 0 0 30px rgba(0, 255, 255, 0.6);
    }

    .gameover-title {
      font-size: clamp(32px, 5vw, 56px); color: #e74c3c;
      margin: 0; text-align: center;
    }
    .money-summary {
      color: #00ffff !important; font-weight: bold;
      font-size: clamp(14px, 1.3vw, 18px) !important;
    }
    .overlay p {
      margin: 4px 0; color: #ccc;
      font-size: clamp(14px, 1.2vw, 17px); text-align: center;
    }

    /* MOBILE */
    @media (max-width: 480px) {
      .character-grid { grid-template-columns: 1fr; }
      .character-card { min-height: auto; }
      .shop-items { grid-template-columns: 1fr 1fr; }
      .market-grid, .upgrade-grid { grid-template-columns: 1fr; }
      .legendary-grid { grid-template-columns: 1fr; }
      .game-canvas { width: 100%; max-height: calc(100vh - 40px); }
    }
  `]
})
export class App {
  private engine = inject(GameEngineService);
  private canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('gameCanvas');

  readonly state = this.engine.state;
  readonly availableWeapons = this.engine.availableWeapons;
  readonly characters = CHARACTERS;
  readonly specialAbilities = SPECIAL_ABILITIES;
  readonly rareItems = RARE_ITEMS;
  readonly legendaryItems = LEGENDARY_ITEMS;
  readonly upgrades = UPGRADES;
  readonly Math = Math;

  constructor() {
    afterNextRender(() => {
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) this.engine.initCanvas(canvas);
    });
  }

  // Menu
  selectCharacter(char: Character): void { this.engine.startGame(char); }

  // Loja padrão
  buyWeapon(weapon: Weapon): void { this.engine.tryBuyWeapon(weapon); }
  skipShop(): void { this.engine.skipShop(); }
  sellWeapon(index: number): void { this.engine.sellWeapon(index); }
  getWeaponCost(): number { return 10 + this.state().wave * 2; }
  getCurrentWeapons(): Weapon[] { return this.engine.getCurrentWeapons(); }
  getMaxWeaponSlots(): number {
    return this.state().ownedLegendaryItems.includes('deathRay') ? 7 : 5;
  }

  // Substituição de arma
  confirmReplace(slot: number): void { this.engine.confirmReplaceWeapon(slot); }
  cancelReplace(): void { this.engine.cancelReplaceWeapon(); }

  // Pause
  pauseGame(): void { this.engine.pauseGame(); }
  resumeGame(): void { this.engine.resumeGame(); }
  quitToMenu(): void { this.engine.quitToMenu(); }
  restart(): void { this.engine.restart(); }

  // Mercado negro
  openBlackMarket(): void { this.engine.openBlackMarket(); }
  closeBlackMarket(): void { this.engine.closeBlackMarket(); }
  buySpecialAbility(id: SpecialAbilityId): void { this.engine.buySpecialAbility(id); }
  buyRareItem(id: RareItemId): void { this.engine.buyRareItem(id); }

  // Upgrades
  buyUpgrade(id: UpgradeId): void { this.engine.buyUpgrade(id); }
  getUpgradePrice(id: UpgradeId): number { return this.engine.getUpgradePrice(id); }
  getUpgradeLevel(id: UpgradeId): number { return this.state().upgrades[id]; }
  isUpgradeMaxed(id: UpgradeId): boolean {
    const up = UPGRADES.find(u => u.id === id);
    return up ? this.state().upgrades[id] >= up.maxLevel : false;
  }

  // Loja lendária
  openLegendaryShop(): void { this.engine.openLegendaryShop(); }
  closeLegendaryShop(): void { this.engine.closeLegendaryShop(); }
  buyLegendaryItem(id: LegendaryItemId): void { this.engine.buyLegendaryItem(id); }
  isOwnedLegendary(id: LegendaryItemId): boolean {
    return this.state().ownedLegendaryItems.includes(id);
  }

  // Helpers
  isOwned(id: RareItemId): boolean {
    return this.state().ownedRareItems.includes(id);
  }
  getBehaviorLabel(weapon: Weapon): string {
    const labels: Record<string, string> = {
      single: 'Tiro Simples', spread: 'Leque', pierce: 'Perfurante',
      explosive: 'Explosivo', chain: 'Corrente', beam: 'Feixe',
      melee: 'Corpo a Corpo', boomerang: 'Bumerangue'
    };
    return labels[weapon.behavior] ?? '';
  }
}
