import type { RaidItem } from '../types';
import { STATUS_LABELS } from '../constants';
import type RaidPlugin from '../main';

function borderKey(item: RaidItem, useSeverityColors: boolean): string {
  if (item.status === 'blocker')               return 'blocker';
  if (item.status === 'in-progress')           return 'in-progress';
  if (['mitigated','closed','confirmed','resolved'].includes(item.status)) return 'done';
  if (useSeverityColors) {
    if (item.severity === 'critical')          return 'critical';
    if (item.severity === 'high')              return 'high';
    if (item.severity === 'medium')            return 'medium';
    return 'low';
  }
  // Severity colors OFF → use RAID type color
  return `type-${item.type}`;
}

const DONE_STATUSES = new Set(['mitigated', 'closed', 'confirmed', 'resolved']);

const OPEN_STATUS: Record<string, RaidItem['status']> = {
  risk: 'open', assumption: 'unconfirmed', issue: 'open', dependency: 'pending',
};
const DONE_STATUS: Record<string, RaidItem['status']> = {
  risk: 'mitigated', assumption: 'confirmed', issue: 'resolved', dependency: 'confirmed',
};

function primaryBadge(item: RaidItem): { text: string; cls: string } {
  if (item.severity) {
    const labels: Record<string, string> = {
      critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low',
    };
    return { text: labels[item.severity] ?? item.severity, cls: `raid-badge--${item.severity}` };
  }
  return {
    text: STATUS_LABELS[item.status] ?? item.status,
    cls:  `raid-badge--status-${item.status}`,
  };
}

const DIR_LABELS: Record<string, string> = {
  inbound: 'Inbound', outbound: 'Outbound', external: 'External',
};

export class ItemCard {
  constructor(
    private container: HTMLElement,
    private item:      RaidItem,
    private plugin:    RaidPlugin,
  ) {}

  render(): HTMLElement {
    const useSev  = this.plugin.settings.showSeverityColors;
    const done    = DONE_STATUSES.has(this.item.status);
    const card    = this.container.createDiv(
      `raid-card raid-card--${borderKey(this.item, useSev)}${done ? ' raid-card--done' : ''}`,
    );

    // ── Body row: checkbox + content ──────────────────────────────────────────
    const body = card.createDiv('raid-card__body');

    // Checkbox
    const check = body.createDiv(`raid-card__check${done ? ' raid-card__check--done' : ''}`);
    check.setAttribute('role', 'checkbox');
    check.title = done ? 'Mark as open' : 'Mark as done';
    check.addEventListener('click', (e) => { e.stopPropagation(); this.toggleDone(); });

    // Content column
    const content = body.createDiv('raid-card__content');

    // Title row (id + title + buttons)
    const titleRow = content.createDiv('raid-card__title-row');
    titleRow.createEl('span', { text: this.item.id, cls: 'raid-card__id-badge' });
    titleRow.createEl('span', { text: this.item.title, cls: 'raid-card__title' });

    // History button (only if history exists)
    if (this.item.history?.length) {
      const histBtn = titleRow.createEl('button', { cls: 'raid-card__history-btn', title: 'View history' });
      histBtn.innerHTML = '&#128338;'; // 🕒
      histBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const { HistoryModal } = await import('../views/HistoryModal');
        new HistoryModal(this.plugin.app, this.item).open();
      });
    }

    const editBtn = titleRow.createEl('button', { cls: 'raid-card__edit-btn', title: 'Edit' });
    editBtn.innerHTML = '&#9998;'; // ✎
    editBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const { ItemFormModal } = await import('../views/ItemFormModal');
      new ItemFormModal(this.plugin.app, this.plugin, this.item.filePath, this.item).open();
    });

    // Description — shown inline without label
    if (this.item.description) {
      content.createEl('p', { text: this.item.description, cls: 'raid-card__desc' });
    }

    // Tags
    if (this.item.tags?.length) {
      const tagsRow = content.createDiv('raid-card__tags');
      for (const tag of this.item.tags) {
        tagsRow.createEl('span', { text: `#${tag}`, cls: 'raid-card__tag' });
      }
    }

    // Badges row
    const badges = content.createDiv('raid-card__badges');

    const typeLabels: Record<string, string> = {
      risk: 'Risk', assumption: 'Assumption', issue: 'Issue', dependency: 'Dependency',
    };
    badges.createEl('span', {
      text: typeLabels[this.item.type] ?? this.item.type,
      cls:  `raid-badge raid-badge--type raid-badge--type-${this.item.type}`,
    });

    const { text: bt, cls: bc } = primaryBadge(this.item);
    badges.createEl('span', { text: bt, cls: `raid-badge ${bc}` });

    if (this.item.type === 'risk') {
      const statusLabels: Record<string, string> = {
        open: 'Open', watch: 'Watch', mitigated: 'Mitigated', closed: 'Closed',
      };
      badges.createEl('span', {
        text: statusLabels[this.item.status] ?? this.item.status,
        cls:  `raid-badge raid-badge--status-${this.item.status}`,
      });
    }

    for (const linked of (this.item.linkedItems ?? [])) {
      badges.createEl('span', { text: linked, cls: 'raid-badge raid-badge--ids' });
    }

    if (this.item.owner) {
      badges.createEl('span', { text: this.item.owner, cls: 'raid-badge raid-badge--owner' });
    }

    // ── Detail panel (expands on card click) ─────────────────────────────────
    const detail = card.createDiv('raid-card__detail');
    const hasDetail = this.buildDetail(detail);

    if (hasDetail) {
      // Show expand hint chevron
      content.createDiv({ text: '▾', cls: 'raid-card__expand-hint' });

      card.addEventListener('click', () => {
        const open = detail.classList.toggle('raid-card__detail--open');
        card.classList.toggle('raid-card--expanded', open);
        const hint = content.querySelector('.raid-card__expand-hint');
        if (hint) hint.textContent = open ? '▴' : '▾';
      });
    }

    // ── Delete button — bottom-right, absolutely positioned ───────────────────
    const delBtn = card.createEl('button', { cls: 'raid-card__del-btn', title: 'Delete' });
    delBtn.innerHTML = '&#x2715;'; // ✕
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${this.item.title}"?`)) {
        this.plugin.store.deleteItem(this.item.id);
      }
    });

    return card;
  }

  // ── Detail panel content ───────────────────────────────────────────────────

  private buildDetail(el: HTMLElement): boolean {
    const item = this.item;
    const rows: Array<[string, string | undefined]> = [];

    if (item.type === 'risk') {
      rows.push(['Mitigation', item.mitigation]);
      if (item.probability || item.probabilityNote) {
        rows.push([
          item.probability ? `Probability — ${item.probability}` : 'Probability',
          item.probabilityNote,
        ]);
      }
      if (item.impact || item.impactNote) {
        rows.push([
          item.impact ? `Impact — ${item.impact}` : 'Impact',
          item.impactNote,
        ]);
      }

    } else if (item.type === 'assumption') {
      if (item.status === 'unconfirmed') {
        rows.push(['Reasoning', item.reasoning]);
        rows.push(['Action',    item.action]);
        rows.push(['If wrong',  item.ifWrong]);
      } else {
        rows.push(['Source',    item.source]);
        rows.push(['Recorded',  item.recorded]);
        rows.push(['Risk',      item.assumptionRisk]);
        if (item.reasoning) rows.push(['Reasoning', item.reasoning]);
        if (item.action)    rows.push(['Action',    item.action]);
        if (item.ifWrong)   rows.push(['If wrong',  item.ifWrong]);
      }

    } else if (item.type === 'issue') {
      rows.push(['Impact', item.issueImpact]);
      if (item.status === 'resolved') {
        rows.push(['Solution', item.solution]);
      } else {
        rows.push(['Action', item.action]);
      }

    } else if (item.type === 'dependency') {
      if (item.dependencyDirection) {
        rows.push(['Direction', DIR_LABELS[item.dependencyDirection] ?? item.dependencyDirection]);
      }
      rows.push(['Contact',        item.dependencyContact]);
      rows.push(['Risk if delayed', item.delayRisk]);
    }

    // Only render rows that have a value
    const filled = rows.filter(([, v]) => v);
    if (!filled.length) return false;

    for (const [label, value] of filled) {
      const row = el.createDiv('raid-card__detail-row');
      row.createEl('span', { text: label, cls: 'raid-card__field-label' });
      row.createEl('span', { text: value!, cls: 'raid-card__field-value' });
    }

    return true;
  }

  private async toggleDone() {
    const done      = DONE_STATUSES.has(this.item.status);
    const newStatus = done ? OPEN_STATUS[this.item.type] : DONE_STATUS[this.item.type];
    if (newStatus) await this.plugin.store.updateItem(this.item.id, { status: newStatus });
  }
}
