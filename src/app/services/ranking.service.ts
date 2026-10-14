import { Injectable, signal } from '@angular/core';
import { RankingEntry, RunStats } from '../models/character.model';

const STORAGE_KEY = 'personato_ranking_v1';
const MAX_ENTRIES = 5;

@Injectable({ providedIn: 'root' })
export class RankingService {
  readonly rankings = signal<RankingEntry[]>([]);

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RankingEntry[];
      if (Array.isArray(parsed)) {
        this.rankings.set(parsed);
      }
    } catch {
      // Ignora erros de parse
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.rankings()));
    } catch {
      // Ignora erros de quota/segurança
    }
  }

  /**
   * Submete uma partida e retorna a posição no ranking (1-based) ou null
   * se não entrou no top 5.
   */
  submit(entry: RankingEntry): { position: number | null; isNewRecord: boolean } {
    const current = [...this.rankings()];
    current.push(entry);

    // Ordena por onda (desc), depois por kills (desc), depois por dano (desc)
    current.sort((a, b) => {
      if (b.wave !== a.wave) return b.wave - a.wave;
      if (b.kills !== a.kills) return b.kills - a.kills;
      return b.damageDealt - a.damageDealt;
    });

    const trimmed = current.slice(0, MAX_ENTRIES);
    const index = trimmed.findIndex(e => e.id === entry.id);
    const position = index >= 0 ? index + 1 : null;
    const isNewRecord = position === 1 && current.length > 1;

    this.rankings.set(trimmed);
    this.save();

    return { position, isNewRecord };
  }

  clear(): void {
    this.rankings.set([]);
    this.save();
  }

  formatDate(timestamp: number): string {
    const d = new Date(timestamp);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm} ${hh}:${mi}`;
  }
}
