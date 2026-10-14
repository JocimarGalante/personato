import {
  Component, inject, viewChild, ElementRef, afterNextRender
} from '@angular/core';
import { GameEngineService } from './services/game-engine.service';
import { CHARACTERS, SPECIAL_ABILITIES, RARE_ITEMS } from './data/characters';
import {
  Character, Weapon, SpecialAbilityId, RareItemId
} from './models/character.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [],
  template: `
    <div class="game-container">

      <!-- ═══════════ MENU PRINCIPAL ═══════════ -->
      @if (state().status === 'menu') {
        <div class="menu-screen">
          <h1 class="title">PERSONATO</h1>
          <p class="subtitle">Sobreviva a ondas infinitas. Bosses a cada 10. Fortuna para os corajosos.</p>
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
                    <div
                      class="ability"
                      [class.active]="ab.trigger === 'active'"
                      [title]="ab.description"
                    >
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
                    <span class="weapon-badge" [style.background]="w.color">
                      {{ w.icon }}
                    </span>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <div
        class="canvas-wrapper"
        [class.hidden]="state().status === 'menu'"
      >
        <canvas #gameCanvas class="game-canvas"></canvas>
      </div>

      <!-- ═══════════ LOJA PADRÃO ═══════════ -->
      @if (state().status === 'shop') {
        <div class="shop-overlay">
          <h2>🛒 Loja — Preparação para a onda {{ state().wave }}</h2>

          <div class="resources-bar">
            <span class="resource materials">💎 {{ state().materials }}</span>
            <span class="resource money">💰 R$ {{ state().money }}</span>
          </div>

          <p class="wave-info">
            ⏱ Duração da próxima onda: <strong>{{ state().timeLeft }}s</strong>
          </p>

          @if (state().wave % 10 === 0) {
            <p class="boss-warning">⚠️ A PRÓXIMA ONDA É DE BOSS ⚠️</p>
          }

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
            <button class="btn-secondary" (click)="pauseGame()">⏸ Pausar [ESC]</button>
            <button class="btn-continue" (click)="skipShop()">Continuar →</button>
          </div>
        </div>
      }

      <!-- ═══════════ MERCADO NEGRO ═══════════ -->
      @if (state().status === 'blackMarket') {
        <div class="market-overlay">
          <h2 class="market-title">🕶️ Mercado Negro</h2>
          <div class="resources-bar">
            <span class="resource money big">💰 R$ {{ state().money }}</span>
          </div>
          <p class="market-subtitle">
            Itens raros e habilidades lendárias. Pagamento apenas em R$.
          </p>

          <div class="market-sections">
            <!-- Habilidades Especiais (slot E) -->
            <div class="market-section">
              <h3>⚡ Habilidade Especial (tecla E)</h3>
              <p class="section-hint">Equipe uma habilidade. Substitui a atual.</p>
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
                      <div class="equipped-badge">✓ Equipada</div>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Itens Raros -->
            <div class="market-section">
              <h3>💎 Itens Raros</h3>
              <p class="section-hint">
                Efeitos permanentes. Cada item só pode ser comprado uma vez.
              </p>
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
          </div>

          <div class="shop-actions">
            <button class="btn-secondary" (click)="closeBlackMarket()">← Voltar</button>
          </div>
        </div>
      }

      <!-- ═══════════ PAUSE ═══════════ -->
      @if (state().status === 'paused') {
        <div class="pause-overlay">
          <h1 class="pause-title">⏸ PAUSADO</h1>
          <p class="pause-info">
            Onda {{ state().wave }} — ⏱ {{ Math.ceil(state().timeLeft) }}s restantes
          </p>
          <div class="pause-stats">
            <div class="stat">
              <div class="stat-value">{{ state().kills }}</div>
              <div class="stat-label">Inimigos</div>
            </div>
            <div class="stat">
              <div class="stat-value">{{ state().damageDealt }}</div>
              <div class="stat-label">Dano Total</div>
            </div>
            <div class="stat">
              <div class="stat-value">{{ state().materials }}</div>
              <div class="stat-label">Materiais</div>
            </div>
            <div class="stat">
              <div class="stat-value money">R$ {{ state().money }}</div>
              <div class="stat-label">Dinheiro</div>
            </div>
          </div>
          <div class="pause-buttons">
            <button class="btn-continue" (click)="resumeGame()">▶ Continuar</button>
            <button class="btn-secondary" (click)="quitToMenu()">🏠 Menu Principal</button>
          </div>
          <p class="pause-hint">Pressione ESC para continuar</p>
        </div>
      }

      <!-- ═══════════ GAME OVER ═══════════ -->
      @if (state().status === 'gameover') {
        <div class="overlay">
          <h1 class="gameover-title">💀 Derrota</h1>
          <p>Onda alcançada: {{ state().wave }}</p>
          <p>Inimigos derrotados: {{ state().kills }}</p>
          <p>Dano total: {{ state().damageDealt }}</p>
          <p class="money-summary">💰 R$ {{ state().money }} acumulados</p>
          <button class="btn-restart" (click)="restart()">Jogar de novo</button>
        </div>
      }

    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
    }

    .game-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 100vh;
      padding: clamp(12px, 2vw, 32px);
    }

    /* ═══ MENU ═══ */
    .menu-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      max-width: min(1400px, 100%);
      margin: 0 auto;
    }

    .title {
      font-size: clamp(36px, 6vw, 72px);
      font-weight: 900;
      background: linear-gradient(135deg, #4ecdc4, #f39c12, #ff69b4);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0 0 clamp(4px, 0.8vw, 12px) 0;
      letter-spacing: clamp(2px, 0.6vw, 6px);
      text-align: center;
      line-height: 1.05;
    }

    .subtitle {
      color: #888;
      margin: 0 0 clamp(20px, 3vh, 36px) 0;
      font-size: clamp(12px, 1.2vw, 16px);
      letter-spacing: clamp(1px, 0.2vw, 2px);
      text-align: center;
      padding: 0 12px;
    }

    .character-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: clamp(10px, 1.4vw, 18px);
      width: 100%;
      max-width: 1280px;
    }

    .character-card {
      background: linear-gradient(160deg, #1a1a2e 0%, #16162a 100%);
      border: 2px solid #333;
      border-radius: 14px;
      padding: clamp(12px, 1.2vw, 18px);
      cursor: pointer;
      transition: transform 0.25s ease, box-shadow 0.25s ease;
      text-align: left;
      display: flex;
      flex-direction: column;
      min-height: 300px;
      position: relative;
      overflow: hidden;
    }

    .character-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at top right, var(--accent), transparent 60%);
      opacity: 0.12;
      pointer-events: none;
    }

    .character-card:hover {
      transform: translateY(-6px) scale(1.02);
      box-shadow: 0 12px 32px rgba(78, 205, 196, 0.2);
    }

    .char-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    .char-emoji {
      font-size: clamp(24px, 2.4vw, 34px);
      width: clamp(42px, 4vw, 54px);
      height: clamp(42px, 4vw, 54px);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      flex-shrink: 0;
    }

    .char-name {
      font-size: clamp(15px, 1.4vw, 19px);
      font-weight: 800;
      letter-spacing: 0.5px;
    }

    .char-lore {
      font-size: clamp(10px, 0.9vw, 11.5px);
      color: #666;
      font-style: italic;
      margin-bottom: 8px;
      line-height: 1.4;
    }

    .char-desc {
      font-size: clamp(11px, 1vw, 12.5px);
      color: #aaa;
      margin-bottom: 12px;
      line-height: 1.45;
    }

    .abilities {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }

    .ability {
      background: #23233a;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: clamp(9.5px, 0.9vw, 11px);
      color: #ccc;
      display: flex;
      align-items: center;
      gap: 6px;
      border-left: 3px solid #444;
    }

    .ability.active {
      border-left-color: #f39c12;
      background: #2a2a18;
    }

    .ability-icon { font-size: 14px; flex-shrink: 0; }
    .ability-name { font-weight: 700; white-space: nowrap; }
    .ability-desc {
      color: #777;
      font-size: clamp(8.5px, 0.8vw, 10px);
      margin-left: auto;
      text-align: right;
      line-height: 1.2;
      max-width: 60%;
    }

    .char-weapons {
      display: flex;
      gap: 6px;
      margin-top: auto;
    }

    .weapon-badge {
      width: clamp(26px, 2.6vw, 32px);
      height: clamp(26px, 2.6vw, 32px);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: clamp(14px, 1.4vw, 17px);
    }

    /* ═══ CANVAS ═══ */
    .canvas-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      max-width: 100%;
      padding: clamp(8px, 1.5vw, 24px);
    }

    .canvas-wrapper.hidden { display: none; }

    .game-canvas {
      border: 2px solid #333;
      border-radius: 8px;
      box-shadow: 0 0 40px rgba(78, 205, 196, 0.1);
      display: block;
      width: min(100%, calc((100vh - 80px) * (4 / 3)));
      height: auto;
      aspect-ratio: 4 / 3;
      max-height: calc(100vh - 80px);
      touch-action: none;
    }

    /* ═══ OVERLAYS ═══ */
    .shop-overlay, .overlay, .pause-overlay, .market-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 15, 26, 0.96);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10;
      gap: clamp(10px, 1.5vh, 18px);
      padding: clamp(16px, 3vw, 40px);
      overflow-y: auto;
    }

    .pause-overlay { backdrop-filter: blur(6px); }
    .market-overlay {
      background: rgba(10, 5, 15, 0.98);
      gap: clamp(8px, 1.2vh, 14px);
    }

    .shop-overlay h2 {
      font-size: clamp(18px, 2.4vw, 28px);
      text-align: center;
      margin: 0;
    }

    .market-title {
      font-size: clamp(22px, 3vw, 34px);
      margin: 0;
      background: linear-gradient(135deg, #8e44ad, #f1c40f);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      text-align: center;
    }

    .market-subtitle {
      color: #888;
      margin: 0;
      font-size: clamp(11px, 1vw, 13px);
      font-style: italic;
      text-align: center;
    }

    .resources-bar {
      display: flex;
      gap: 20px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: center;
    }

    .resource {
      font-size: clamp(15px, 1.4vw, 19px);
      font-weight: bold;
      padding: 6px 14px;
      border-radius: 6px;
      background: #1a1a2e;
      border: 1px solid #333;
    }

    .resource.materials { color: #4ecdc4; }
    .resource.money { color: #2ecc71; }
    .resource.money.big { font-size: clamp(18px, 1.8vw, 24px); }

    .wave-info {
      color: #4ecdc4;
      font-size: clamp(12px, 1.1vw, 14px);
      margin: 0;
    }

    .boss-warning {
      color: #e74c3c;
      font-weight: bold;
      font-size: clamp(13px, 1.2vw, 16px);
      animation: pulse 1.5s infinite;
      margin: 0;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .shop-items {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 220px));
      gap: clamp(10px, 1.4vw, 18px);
      margin: clamp(10px, 1.5vh, 20px) 0;
      justify-content: center;
      width: 100%;
      max-width: 1000px;
    }

    .shop-item {
      background: #1a1a2e;
      border: 2px solid #333;
      border-radius: 10px;
      padding: clamp(12px, 1.2vw, 16px);
      cursor: pointer;
      text-align: center;
      transition: transform 0.15s, box-shadow 0.15s;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 200px;
    }

    .shop-item:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 20px rgba(255, 255, 255, 0.15);
    }

    .weapon-icon { font-size: clamp(24px, 2.8vw, 34px); margin-bottom: 8px; }
    .weapon-name { font-weight: bold; margin-bottom: 4px; font-size: clamp(13px, 1.1vw, 15px); }
    .weapon-behavior {
      font-size: clamp(9px, 0.85vw, 10.5px);
      color: #4ecdc4;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .weapon-stats {
      font-size: clamp(10px, 0.95vw, 11.5px);
      color: #888;
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }
    .weapon-price {
      margin-top: 10px;
      color: #f1c40f;
      font-weight: bold;
      font-size: clamp(13px, 1.1vw, 15px);
    }

    .shop-actions, .pause-buttons {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
      margin-top: 8px;
    }

    /* ═══ MERCADO NEGRO ═══ */
    .market-sections {
      display: flex;
      flex-direction: column;
      gap: clamp(16px, 2vh, 24px);
      width: 100%;
      max-width: 1100px;
    }

    .market-section h3 {
      font-size: clamp(14px, 1.3vw, 18px);
      color: #f1c40f;
      margin: 0 0 4px 0;
    }

    .section-hint {
      font-size: clamp(10px, 0.9vw, 12px);
      color: #666;
      margin: 0 0 10px 0;
    }

    .market-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 10px;
    }

    .market-item {
      background: #1a1a2e;
      border: 2px solid #333;
      border-radius: 10px;
      padding: 12px;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .market-item.affordable:hover {
      transform: scale(1.03);
      box-shadow: 0 0 20px rgba(241, 196, 15, 0.3);
      border-color: #f1c40f;
    }

    .market-item.equipped {
      border-color: #f1c40f;
      background: #2a2a18;
    }

    .market-item.owned {
      border-color: #2ecc71;
      background: #1a2a1f;
      cursor: default;
      opacity: 0.75;
    }

    .market-item:not(.affordable):not(.equipped):not(.owned) {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .ability-item { border-left: 4px solid #f1c40f; }
    .rare-item { border-left: 4px solid #8e44ad; }

    .market-icon { font-size: 28px; }
    .market-name { font-weight: bold; font-size: clamp(12px, 1.1vw, 14px); }
    .market-desc {
      font-size: clamp(10px, 0.9vw, 11.5px);
      color: #999;
      flex: 1;
    }
    .market-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 4px;
    }
    .price { color: #f1c40f; font-weight: bold; font-size: 13px; }
    .cooldown { color: #666; font-size: 11px; }

    .equipped-badge, .owned-badge {
      position: absolute;
      top: 6px;
      right: 6px;
      color: #0f0f1a;
      font-size: 9px;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .equipped-badge { background: #f1c40f; }
    .owned-badge { background: #2ecc71; }

    /* ═══ PAUSE ═══ */
    .pause-title {
      font-size: clamp(36px, 5vw, 64px);
      font-weight: 900;
      color: #4ecdc4;
      margin: 0;
      letter-spacing: 4px;
      text-shadow: 0 0 30px rgba(78, 205, 196, 0.5);
    }

    .pause-info {
      font-size: clamp(14px, 1.3vw, 18px);
      color: #aaa;
      margin: 0;
    }

    .pause-stats {
      display: flex;
      gap: clamp(20px, 4vw, 60px);
      margin: clamp(16px, 2vh, 28px) 0;
      flex-wrap: wrap;
      justify-content: center;
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .stat-value {
      font-size: clamp(24px, 3vw, 40px);
      font-weight: 900;
      color: #f1c40f;
      font-family: monospace;
    }

    .stat-value.money { color: #2ecc71; }

    .stat-label {
      font-size: clamp(10px, 0.9vw, 12px);
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }

    .pause-hint {
      color: #444;
      font-size: clamp(11px, 0.9vw, 13px);
      margin: 0;
      font-style: italic;
    }

    /* ═══ BOTÕES ═══ */
    .btn-continue, .btn-restart, .btn-secondary, .btn-market {
      border: none;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      flex-shrink: 0;
      font-family: inherit;
      padding: clamp(10px, 1.2vh, 14px) clamp(24px, 3vw, 40px);
      font-size: clamp(14px, 1.3vw, 18px);
    }

    .btn-continue, .btn-restart {
      background: linear-gradient(135deg, #4ecdc4, #2ecc71);
      color: #0f0f1a;
    }

    .btn-secondary {
      background: #2a2a45;
      color: #ccc;
      border: 2px solid #3a3a55;
    }

    .btn-market {
      background: linear-gradient(135deg, #8e44ad, #f1c40f);
      color: #0f0f1a;
    }

    .btn-continue:hover, .btn-restart:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 20px rgba(78, 205, 196, 0.4);
    }

    .btn-secondary:hover {
      transform: scale(1.05);
      background: #3a3a55;
      box-shadow: 0 4px 20px rgba(255, 255, 255, 0.1);
    }

    .btn-market:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 20px rgba(241, 196, 15, 0.4);
    }

    .gameover-title {
      font-size: clamp(32px, 5vw, 56px);
      color: #e74c3c;
      margin: 0;
      text-align: center;
    }

    .money-summary {
      color: #2ecc71 !important;
      font-weight: bold;
      font-size: clamp(16px, 1.4vw, 20px) !important;
    }

    .overlay p {
      margin: 4px 0;
      color: #ccc;
      font-size: clamp(14px, 1.2vw, 17px);
      text-align: center;
    }

    /* ═══ MOBILE ═══ */
    @media (max-width: 480px) {
      .character-grid { grid-template-columns: 1fr; }
      .character-card { min-height: auto; }
      .shop-items { grid-template-columns: 1fr 1fr; }
      .market-grid { grid-template-columns: 1fr 1fr; }
      .game-canvas { width: 100%; max-height: calc(100vh - 40px); }
      .pause-stats { gap: 20px; }
    }

    @media (max-height: 500px) and (orientation: landscape) {
      .game-canvas {
        max-height: calc(100vh - 20px);
        width: auto;
      }
      .menu-screen { padding: 8px; }
      .title { font-size: 32px; }
      .subtitle { display: none; }
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
  readonly Math = Math;

  constructor() {
    afterNextRender(() => {
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) {
        this.engine.initCanvas(canvas);
      }
    });
  }

  selectCharacter(char: Character): void {
    this.engine.startGame(char);
  }

  buyWeapon(weapon: Weapon): void {
    this.engine.buyWeapon(weapon);
  }

  skipShop(): void {
    this.engine.skipShop();
  }

  getWeaponCost(): number {
    return 10 + this.state().wave * 2;
  }

  getBehaviorLabel(weapon: Weapon): string {
    const labels: Record<string, string> = {
      single: 'Tiro Simples',
      spread: 'Leque',
      pierce: 'Perfurante',
      explosive: 'Explosivo',
      chain: 'Corrente Elétrica',
      beam: 'Feixe Contínuo',
      melee: 'Corpo a Corpo',
      boomerang: 'Bumerangue'
    };
    return labels[weapon.behavior] ?? '';
  }

  pauseGame(): void {
    this.engine.pauseGame();
  }

  resumeGame(): void {
    this.engine.resumeGame();
  }

  quitToMenu(): void {
    this.engine.quitToMenu();
  }

  restart(): void {
    this.engine.restart();
  }

  openBlackMarket(): void {
    this.engine.openBlackMarket();
  }

  closeBlackMarket(): void {
    this.engine.closeBlackMarket();
  }

  buySpecialAbility(id: SpecialAbilityId): void {
    this.engine.buySpecialAbility(id);
  }

  buyRareItem(id: RareItemId): void {
    this.engine.buyRareItem(id);
  }

  isOwned(id: RareItemId): boolean {
    return this.state().ownedRareItems.includes(id);
  }
}
