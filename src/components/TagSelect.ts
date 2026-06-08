export interface TagSelectOptions {
  availableTags: string[];
  value:         string[];
  onChange:      (tags: string[]) => void;
  onAddNew:      (tag: string) => Promise<void>;
}

export class TagSelect {
  private inputEl!:  HTMLInputElement;
  private chipsEl!:  HTMLElement;
  private dropdown:  HTMLElement | null = null;
  private selected:  string[];

  constructor(
    private container: HTMLElement,
    private opts: TagSelectOptions,
  ) {
    this.selected = [...opts.value];
  }

  render(): HTMLElement {
    const wrapper = this.container.createDiv('raid-tag-select');
    wrapper.addEventListener('click', () => this.inputEl?.focus());

    this.chipsEl = wrapper.createDiv('raid-tag-select__chips');
    this.renderChips(wrapper);

    this.inputEl = wrapper.createEl('input', { cls: 'raid-tag-select__input' });
    this.inputEl.type        = 'text';
    this.inputEl.placeholder = this.selected.length ? '' : 'Add tag…';

    this.inputEl.addEventListener('focus', () => this.openDropdown());
    this.inputEl.addEventListener('input', () => this.openDropdown());
    this.inputEl.addEventListener('keydown', (e) => this.onKey(e));
    this.inputEl.addEventListener('blur', () => setTimeout(() => this.closeDropdown(), 160));

    return wrapper;
  }

  private renderChips(wrapper: HTMLElement) {
    this.chipsEl.empty();
    for (const tag of this.selected) {
      const chip = this.chipsEl.createEl('span', { cls: 'raid-tag-chip' });
      chip.createEl('span', { text: `#${tag}`, cls: 'raid-tag-chip__text' });
      const del = chip.createEl('button', { cls: 'raid-tag-chip__del' });
      del.type    = 'button';
      del.textContent = '×';
      del.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.removeTag(tag);
      });
    }
    if (this.inputEl) {
      this.inputEl.placeholder = this.selected.length ? '' : 'Add tag…';
    }
  }

  private onKey(e: KeyboardEvent) {
    const val = this.inputEl.value.trim().replace(/^#+/, '');
    if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && val) {
      e.preventDefault();
      this.addTag(val);
      return;
    }
    if (e.key === 'Backspace' && !this.inputEl.value && this.selected.length) {
      e.preventDefault();
      this.removeTag(this.selected[this.selected.length - 1]);
    }
  }

  private async addTag(raw: string) {
    const tag = raw.toLowerCase().replace(/[,\s]+/g, '-').replace(/[^a-zA-Zа-яёА-ЯЁ0-9\-_]/g, '');
    if (!tag || this.selected.includes(tag)) {
      this.inputEl.value = '';
      return;
    }
    if (!this.opts.availableTags.includes(tag)) {
      await this.opts.onAddNew(tag);
      this.opts.availableTags.push(tag);
    }
    this.selected.push(tag);
    this.opts.onChange([...this.selected]);
    this.inputEl.value = '';
    this.renderChips(this.inputEl.parentElement as HTMLElement);
    this.closeDropdown();
  }

  private removeTag(tag: string) {
    this.selected = this.selected.filter(t => t !== tag);
    this.opts.onChange([...this.selected]);
    this.renderChips(this.inputEl.parentElement as HTMLElement);
  }

  private openDropdown() {
    this.closeDropdown();
    const query    = this.inputEl.value.trim().toLowerCase().replace(/^#+/, '');
    const filtered = this.opts.availableTags
      .filter(t => !this.selected.includes(t))
      .filter(t => !query || t.includes(query));

    if (!filtered.length) return;

    this.dropdown = this.inputEl.ownerDocument.body.createDiv('raid-owner-dropdown');

    for (const tag of filtered.slice(0, 12)) {
      const row = this.dropdown.createDiv('raid-owner-dropdown__item');
      const idx = query ? tag.indexOf(query) : -1;
      if (idx >= 0) {
        row.createEl('span', { text: '#' + tag.slice(0, idx) });
        row.createEl('mark',  { text: tag.slice(idx, idx + query.length), cls: 'raid-owner-match' });
        row.createEl('span',  { text: tag.slice(idx + query.length) });
      } else {
        row.setText(`#${tag}`);
      }
      row.addEventListener('mousedown', async (e) => {
        e.preventDefault();
        await this.addTag(tag);
      });
    }

    const rect = this.inputEl.getBoundingClientRect();
    this.dropdown.style.top      = `${rect.bottom + 3}px`;
    this.dropdown.style.left     = `${rect.left}px`;
    this.dropdown.style.minWidth = `${Math.max(rect.width, 180)}px`;
  }

  private closeDropdown() {
    this.dropdown?.remove();
    this.dropdown = null;
  }
}
