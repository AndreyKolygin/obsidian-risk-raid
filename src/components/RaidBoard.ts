import type { RaidItem, RaidType } from '../types';
import type RaidPlugin from '../main';
import { ItemCard } from './ItemCard';

const DAYS_EN   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function dateKey(item: RaidItem): string | null {
  return item.deadline ? item.deadline.split('T')[0] : null;
}

function formatDate(key: string): { weekday: string; label: string } {
  const d = new Date(key + 'T12:00');
  return {
    weekday: DAYS_EN[d.getDay()],
    label:   `${d.getDate()} ${MONTHS_EN[d.getMonth()]}`,
  };
}

function itemTime(item: RaidItem): string | null {
  if (!item.deadline?.includes('T')) return null;
  return item.deadline.slice(11, 16); // HH:MM
}

const SEV_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
function itemWeight(i: RaidItem): number {
  return i.status === 'blocker' ? 5 : (SEV_WEIGHT[i.severity ?? ''] ?? 0);
}

export class RaidBoard {
  constructor(
    private container: HTMLElement,
    private items:     RaidItem[],
    private plugin:    RaidPlugin,
    private activeType: RaidType | 'all',
  ) {}

  render() {
    if (this.items.length === 0) {
      this.container.createEl('p', {
        text: 'No items match the current filter.',
        cls:  'raid-empty-state',
      });
      return;
    }

    // Group by deadline date
    const map = new Map<string | null, RaidItem[]>();
    for (const item of this.items) {
      const k = dateKey(item);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(item);
    }
    for (const arr of map.values()) arr.sort((a, b) => itemWeight(b) - itemWeight(a));

    const sorted = [...map.entries()].sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a.localeCompare(b);
    });

    for (const [key, group] of sorted) {
      const dateGroup = this.container.createDiv('raid-date-group');

      group.forEach((item, idx) => {
        const row = dateGroup.createDiv('raid-card-row');

        // ── Left: date stamp ────────────────────────────────────────────────
        const stamp = row.createDiv('raid-date-stamp');
        if (idx === 0 && key) {
          const { weekday, label } = formatDate(key);
          stamp.createEl('span', { text: weekday, cls: 'raid-date-weekday' });
          stamp.createEl('span', { text: label,   cls: 'raid-date-label'   });
        } else if (idx === 0 && !key) {
          stamp.createEl('span', { text: '—',        cls: 'raid-date-weekday' });
          stamp.createEl('span', { text: 'No date', cls: 'raid-date-label'   });
        }
        // Time — shown for every card that has it
        const t = itemTime(item);
        if (t) stamp.createEl('span', { text: t, cls: 'raid-date-time' });

        // ── Right: card ─────────────────────────────────────────────────────
        new ItemCard(row, item, this.plugin).render();
      });
    }
  }
}
