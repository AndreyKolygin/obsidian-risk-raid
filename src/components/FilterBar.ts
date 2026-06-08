import type { RaidType } from '../types';
import { TYPE_STATUSES, STATUS_LABELS } from '../constants';

function debounce(fn: (v: string) => void, ms: number): (v: string) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (v: string) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(v), ms);
  };
}

interface FilterBarOptions {
  activeType:    RaidType | 'all';
  activeStatus:  string;
  searchQuery:   string;
  ownerFilter:   string;
  onTypeChange:  (type: RaidType | 'all') => void;
  onStatusChange:(status: string) => void;
  onSearch:      (q: string) => void;
  onOwnerFilter: (owner: string) => void;
}

export class FilterBar {
  private container: HTMLElement;
  private opts: FilterBarOptions;

  constructor(container: HTMLElement, opts: FilterBarOptions) {
    this.container = container;
    this.opts = opts;
  }

  render() {
    const bar = this.container.createDiv('raid-filter-bar');

    // Controls row
    const controls = bar.createDiv('raid-filter-controls');

    // Status dropdown
    const statusSelect = controls.createEl('select', { cls: 'raid-filter-select' });
    statusSelect.createEl('option', { text: 'All statuses', value: '' });
    const statuses = this.opts.activeType === 'all'
      ? Object.keys(STATUS_LABELS)
      : TYPE_STATUSES[this.opts.activeType as RaidType] ?? [];
    for (const s of statuses) {
      const opt = statusSelect.createEl('option', { text: STATUS_LABELS[s] || s, value: s });
      if (this.opts.activeStatus === s) opt.selected = true;
    }
    statusSelect.value = this.opts.activeStatus;
    statusSelect.onchange = () => this.opts.onStatusChange(statusSelect.value);

    // Owner input
    const ownerInput = controls.createEl('input', {
      type: 'text',
      cls:  'raid-filter-input',
      placeholder: 'Filter by owner...',
    } as DomElementInfo & { placeholder: string });
    ownerInput.value = this.opts.ownerFilter;
    const debouncedOwner = debounce(v => this.opts.onOwnerFilter(v), 1000);
    ownerInput.oninput = () => debouncedOwner(ownerInput.value);

    // Search input
    const searchInput = controls.createEl('input', {
      type: 'text',
      cls:  'raid-filter-input',
      placeholder: 'Search...',
    } as DomElementInfo & { placeholder: string });
    searchInput.value = this.opts.searchQuery;
    const debouncedSearch = debounce(v => this.opts.onSearch(v), 1000);
    searchInput.oninput = () => debouncedSearch(searchInput.value);
  }
}
