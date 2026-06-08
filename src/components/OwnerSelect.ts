export interface OwnerSelectOptions {
  owners:   string[];
  value:    string;
  onChange: (v: string) => void;
  onAddNew: (name: string) => Promise<void>;
}

export class OwnerSelect {
  private inputEl!: HTMLInputElement;
  private dropdown: HTMLElement | null = null;

  constructor(
    private container: HTMLElement,
    private opts: OwnerSelectOptions,
  ) {}

  render(): HTMLInputElement {
    this.inputEl = this.container.createEl('input');
    this.inputEl.type        = 'text';
    this.inputEl.placeholder = 'Search or add owner…';
    this.inputEl.value       = this.opts.value;
    this.inputEl.className   = 'raid-owner-input';

    this.inputEl.addEventListener('focus', () => this.open());
    this.inputEl.addEventListener('input', () => this.open());
    // Delay so mousedown on items fires before blur closes the dropdown
    this.inputEl.addEventListener('blur', () => setTimeout(() => this.close(), 160));

    return this.inputEl;
  }

  private open() {
    this.close();

    const query    = this.inputEl.value.trim().toLowerCase();
    const filtered = this.opts.owners.filter(o => o.toLowerCase().includes(query));
    const exact    = this.opts.owners.some(o => o.toLowerCase() === query);

    // Nothing to show
    if (filtered.length === 0 && (!this.inputEl.value.trim() || exact)) return;

    this.dropdown = this.inputEl.ownerDocument.body.createDiv('raid-owner-dropdown');

    const MAX = 12;
    const visible = filtered.slice(0, MAX);

    for (const owner of visible) {
      const row = this.dropdown.createDiv('raid-owner-dropdown__item');
      this.highlight(row, owner, query);
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.select(owner);
      });
    }

    if (filtered.length > MAX) {
      this.dropdown.createDiv('raid-owner-dropdown__overflow').setText(
        `+${filtered.length - MAX} — продолжайте вводить для фильтрации`,
      );
    }

    // Add-new row
    const newName = this.inputEl.value.trim();
    if (newName && !exact) {
      const addRow = this.dropdown.createDiv('raid-owner-dropdown__item raid-owner-dropdown__item--add');
      addRow.createEl('span', { text: '+ Добавить: ', cls: 'raid-owner-add-label' });
      addRow.createEl('span', { text: newName });
      addRow.addEventListener('mousedown', async (e) => {
        e.preventDefault();
        await this.opts.onAddNew(newName);
        // Refresh owners list in dropdown
        if (!this.opts.owners.includes(newName)) this.opts.owners.push(newName);
        this.select(newName);
      });
    }

    // Position below the input
    const rect = this.inputEl.getBoundingClientRect();
    this.dropdown.style.top      = `${rect.bottom + 3}px`;
    this.dropdown.style.left     = `${rect.left}px`;
    this.dropdown.style.minWidth = `${Math.max(rect.width, 220)}px`;
  }

  private close() {
    this.dropdown?.remove();
    this.dropdown = null;
  }

  private select(owner: string) {
    this.inputEl.value = owner;
    this.opts.onChange(owner);
    this.close();
  }

  private highlight(el: HTMLElement, text: string, query: string) {
    if (!query) { el.setText(text); return; }
    const idx = text.toLowerCase().indexOf(query);
    if (idx < 0) { el.setText(text); return; }
    el.createEl('span', { text: text.slice(0, idx) });
    el.createEl('mark',  { text: text.slice(idx, idx + query.length), cls: 'raid-owner-match' });
    el.createEl('span',  { text: text.slice(idx + query.length) });
  }
}
