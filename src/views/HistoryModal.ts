import { App, Modal } from 'obsidian';
import type { RaidItem, HistoryEntry } from '../types';

export class HistoryModal extends Modal {
  constructor(app: App, private item: RaidItem) {
    super(app);
  }

  onOpen() {
    this.modalEl.addClass('raid-history-modal');

    const { contentEl, item } = this;
    contentEl.empty();

    // Header
    const header = contentEl.createDiv('raid-history-header');
    header.createEl('span', {
      text: item.id,
      cls:  `raid-badge raid-badge--type raid-badge--type-${item.type}`,
    });
    header.createEl('h2', { text: item.title, cls: 'raid-history-title' });

    // Timeline — newest first
    const history = [...(item.history ?? [])].reverse();

    if (!history.length) {
      contentEl.createEl('p', { text: 'No history yet.', cls: 'raid-empty-state' });
      return;
    }

    const timeline = contentEl.createDiv('raid-history-timeline');

    for (const entry of history) {
      const block = timeline.createDiv('raid-history-entry');

      block.createEl('div', {
        text: formatDate(entry.date),
        cls:  'raid-history-entry__date',
      });

      const list = block.createEl('ul', { cls: 'raid-history-entry__list' });
      for (const change of entry.changes) {
        list.createEl('li', { text: change, cls: 'raid-history-entry__change' });
      }
    }
  }

  onClose() { this.contentEl.empty(); }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
