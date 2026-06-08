import { App, Modal, Notice } from 'obsidian';
import { OwnerSelect } from '../components/OwnerSelect';
import { TagSelect } from '../components/TagSelect';
import type { RaidItem, RaidType } from '../types';
import { TYPE_STATUSES, STATUS_LABELS, SEVERITY_MATRIX } from '../constants';
import type RaidPlugin from '../main';

const TYPE_LABELS: Record<string, string> = {
  risk: 'Risk', assumption: 'Assumption', issue: 'Issue', dependency: 'Dependency',
};
const TYPE_LETTERS: Record<string, string> = {
  risk: 'R', assumption: 'A', issue: 'I', dependency: 'D',
};

// Statuses where dependency is "done" (no delay risk shown)
const DEP_DONE = new Set(['confirmed']);
// Issue statuses that show Solution instead of Action
const ISSUE_RESOLVED = new Set(['resolved']);
// Assumption statuses
const ASSM_CONFIRMED = new Set(['confirmed']);

export class ItemFormModal extends Modal {
  private plugin:      RaidPlugin;
  private item?:       RaidItem;
  private projectPath: string;
  private data:        Partial<RaidItem>;

  constructor(app: App, plugin: RaidPlugin, projectPath: string, item?: RaidItem) {
    super(app);
    this.plugin      = plugin;
    this.item        = item;
    this.projectPath = item ? item.filePath : projectPath;
    this.data        = item ? { ...item } : { type: 'risk' };
  }

  onOpen() {
    this.modalEl.addClass('raid-form-modal');
    this.rebuild();
  }

  onClose() { this.contentEl.empty(); }

  private rebuild() {
    this.contentEl.empty();
    this.buildForm(this.contentEl);
  }

  private buildForm(el: HTMLElement) {
    const type: RaidType = (this.data.type as RaidType) || 'risk';
    const status = (this.data.status as string) || '';

    // ── Header ────────────────────────────────────────────────────────────────
    const header = el.createDiv(`raid-form-header raid-form-header--${type}`);

    header.createEl('span', {
      text: TYPE_LETTERS[type],
      cls: `raid-form-header__letter raid-form-header__letter--${type}`,
    });

    const titleText = this.item
      ? `${this.item.id} — ${this.item.title}`
      : `New ${TYPE_LABELS[type]}`;
    header.createEl('h2', { text: titleText, cls: 'raid-form-header__title' });

    if (!this.item) {
      const typeSelect = header.createEl('select', { cls: 'raid-form-type-select' });
      for (const [val, lbl] of Object.entries(TYPE_LABELS)) {
        const opt = typeSelect.createEl('option', { value: val, text: lbl });
        if (val === type) opt.selected = true;
      }
      typeSelect.addEventListener('change', () => {
        this.data.type   = typeSelect.value as RaidType;
        this.data.status = undefined;
        this.rebuild();
      });
    }

    // ── Body ──────────────────────────────────────────────────────────────────
    const body = el.createDiv('raid-form-body');

    // Project selector (new items, multiple projects)
    if (!this.item) {
      const projects = this.plugin.store.getProjects();
      if (projects.length > 1) {
        const f = this.field(body, 'Project');
        const sel = f.createEl('select', { cls: 'raid-form-select' });
        for (const p of projects) {
          const opt = sel.createEl('option', { value: p.filePath, text: p.name });
          if (p.filePath === this.projectPath) opt.selected = true;
        }
        sel.addEventListener('change', () => (this.projectPath = sel.value));
      }
    }

    // Title
    const titleF = this.field(body, 'Title', true);
    const titleInput = titleF.createEl('input', { cls: 'raid-form-input' });
    titleInput.type = 'text';
    titleInput.placeholder = 'Enter title…';
    titleInput.value = this.data.title || '';
    titleInput.addEventListener('input', () => (this.data.title = titleInput.value));
    setTimeout(() => titleInput.focus(), 40);

    // ── Status (shown early so user can change it and see conditional fields) ──
    const statuses = TYPE_STATUSES[type] || [];
    const curStatus = (this.data.status as string) || statuses[0] || '';
    if (!this.data.status) this.data.status = (statuses[0] || '') as RaidItem['status'];

    // ── Type + status contextual section ─────────────────────────────────────
    this.buildContextual(body, type, curStatus);

    // ── Details ───────────────────────────────────────────────────────────────
    this.divider(body, 'Details');

    const detailsGrid = body.createDiv('raid-form-grid--2col');

    // Status
    const statusF = this.field(detailsGrid, 'Status');
    const statusSel = statusF.createEl('select', { cls: 'raid-form-select' });
    for (const s of statuses) {
      const opt = statusSel.createEl('option', { value: s, text: STATUS_LABELS[s] || s });
      if (s === curStatus) opt.selected = true;
    }
    statusSel.addEventListener('change', () => {
      this.data.status = statusSel.value as RaidItem['status'];
      this.rebuild();
    });

    // Owner
    const ownerF = this.field(detailsGrid, 'Owner');
    new OwnerSelect(ownerF, {
      owners:   [...this.plugin.settings.customOwners],
      value:    this.data.owner || '',
      onChange: v => (this.data.owner = v),
      onAddNew: async (name) => {
        if (!this.plugin.settings.customOwners.includes(name)) {
          this.plugin.settings.customOwners.push(name);
          await this.plugin.saveSettings();
        }
      },
    }).render();

    // Deadline + Tags (for non-dependency: deadline is generic; for dependency it's in contextual)
    const metaGrid = body.createDiv('raid-form-grid--2col');

    if (type !== 'dependency') {
      const deadlineF = this.field(metaGrid, 'Deadline');
      const dateInput = deadlineF.createEl('input', { cls: 'raid-form-input' });
      dateInput.type = 'datetime-local';
      const raw = this.data.deadline || '';
      dateInput.value = raw.length === 10 ? raw + 'T00:00'
        : raw.length >= 16 ? raw.slice(0, 16)
        : raw;
      dateInput.addEventListener('change', () => (this.data.deadline = dateInput.value || undefined));
    }

    const tagsF = this.field(metaGrid, 'Tags');
    new TagSelect(tagsF, {
      availableTags: [...this.plugin.settings.customTags],
      value:         this.data.tags ?? [],
      onChange:      v => (this.data.tags = v.length ? v : undefined),
      onAddNew:      async (tag) => {
        if (!this.plugin.settings.customTags.includes(tag)) {
          this.plugin.settings.customTags.push(tag);
          await this.plugin.saveSettings();
        }
      },
    }).render();

    // Linked items
    const linkedF = this.field(body, 'Linked Items');
    linkedF.createEl('span', { text: 'IDs separated by commas, e.g. R-001, D-002', cls: 'raid-form-field__hint' });
    const linkedInput = linkedF.createEl('input', { cls: 'raid-form-input' });
    linkedInput.type = 'text';
    linkedInput.placeholder = 'R-001, D-002…';
    linkedInput.value = this.data.linkedItems?.join(', ') || '';
    linkedInput.addEventListener('input', () => {
      this.data.linkedItems = linkedInput.value
        ? linkedInput.value.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;
    });

    // ── Footer ────────────────────────────────────────────────────────────────
    const footer = el.createDiv('raid-form-footer');
    footer.createEl('button', { text: 'Cancel', cls: 'raid-form-btn' })
      .addEventListener('click', () => this.close());
    footer.createEl('button', {
      text: this.item ? 'Save Changes' : 'Create',
      cls:  'raid-form-btn raid-form-btn--primary mod-cta',
    }).addEventListener('click', () => this.submit());
  }

  // ── Contextual section (type + status aware) ───────────────────────────────

  private buildContextual(body: HTMLElement, type: RaidType, status: string) {
    switch (type) {
      case 'risk':        return this.buildRiskSection(body);
      case 'assumption':  return this.buildAssumptionSection(body, status);
      case 'issue':       return this.buildIssueSection(body, status);
      case 'dependency':  return this.buildDependencySection(body, status);
    }
  }

  private buildRiskSection(body: HTMLElement) {
    this.ta(body, 'Description', 'description', 'Short description…');

    // Divider with severity preview on the right
    const riskDivider = this.divider(body, 'Risk Assessment');
    const preview = riskDivider.createDiv('raid-severity-preview');

    const grid = body.createDiv('raid-form-grid--2col');

    // ── Probability column ──
    const probCol = grid.createDiv('raid-form-field');
    probCol.createEl('label', { text: 'Probability', cls: 'raid-form-field__label' });
    const probSel = probCol.createEl('select', { cls: 'raid-form-select' });
    probSel.createEl('option', { value: '', text: '— Select —' });
    for (const v of ['high', 'medium', 'low']) {
      const opt = probSel.createEl('option', { value: v, text: v[0].toUpperCase() + v.slice(1) });
      if (v === this.data.probability) opt.selected = true;
    }
    const probTA = probCol.createEl('textarea', { cls: 'raid-form-textarea raid-form-textarea--note' });
    probTA.placeholder = 'Why this probability?…';
    probTA.value = this.data.probabilityNote || '';
    probTA.addEventListener('input', () => (this.data.probabilityNote = probTA.value || undefined));

    // ── Impact column ──
    const impactCol = grid.createDiv('raid-form-field');
    impactCol.createEl('label', { text: 'Impact', cls: 'raid-form-field__label' });
    const impactSel = impactCol.createEl('select', { cls: 'raid-form-select' });
    impactSel.createEl('option', { value: '', text: '— Select —' });
    for (const v of ['high', 'medium', 'low']) {
      const opt = impactSel.createEl('option', { value: v, text: v[0].toUpperCase() + v.slice(1) });
      if (v === this.data.impact) opt.selected = true;
    }
    const impactTA = impactCol.createEl('textarea', { cls: 'raid-form-textarea raid-form-textarea--note' });
    impactTA.placeholder = 'What is affected and how?…';
    impactTA.value = this.data.impactNote || '';
    impactTA.addEventListener('input', () => (this.data.impactNote = impactTA.value || undefined));

    const refreshPreview = () => {
      preview.empty();
      if (this.data.probability && this.data.impact) {
        const sev = SEVERITY_MATRIX[this.data.probability][this.data.impact];
        preview.createEl('span', { text: 'Severity: ', cls: 'raid-severity-preview__label' });
        preview.createEl('span', {
          text: sev[0].toUpperCase() + sev.slice(1),
          cls: `raid-badge raid-badge--${sev}`,
        });
      }
    };
    probSel.addEventListener('change', () => {
      this.data.probability = probSel.value as RaidItem['probability'];
      refreshPreview();
    });
    impactSel.addEventListener('change', () => {
      this.data.impact = impactSel.value as RaidItem['impact'];
      refreshPreview();
    });
    refreshPreview();

    this.ta(body, 'Mitigation', 'mitigation', 'Mitigation plan…');
  }

  private buildAssumptionSection(body: HTMLElement, status: string) {
    this.ta(body, 'Description', 'description', 'Describe the assumption…');

    if (ASSM_CONFIRMED.has(status)) {
      this.divider(body, 'Confirmation');
      this.inp(body, 'Source',        'source',         'Where was this confirmed?');
      this.inp(body, 'Recorded',      'recorded',       'Document / link / note…');
      this.ta(body,  'Risk if wrong', 'assumptionRisk', 'What happens if this is incorrect?');
    } else {
      this.divider(body, 'Assumption Details');
      this.ta(body, 'Reasoning',     'reasoning', 'Why do we believe this?');
      this.ta(body, 'Action',        'action',    'What action is required to confirm?');
      this.ta(body, 'If wrong',      'ifWrong',   'Consequences if assumption is incorrect…');
    }
  }

  private buildIssueSection(body: HTMLElement, status: string) {
    this.ta(body, 'Description', 'description', 'Describe the issue…');

    this.divider(body, 'Issue Details');
    this.ta(body, 'Impact', 'issueImpact', 'Business / team impact…');

    if (ISSUE_RESOLVED.has(status)) {
      this.ta(body, 'Solution', 'solution', 'How was this resolved?');
    } else {
      this.ta(body, 'Action', 'action', 'Next action…');
    }
  }

  private buildDependencySection(body: HTMLElement, status: string) {
    this.ta(body, 'What is needed', 'description', 'Describe what you depend on…');

    this.divider(body, 'Dependency Details');

    const dirGrid = body.createDiv('raid-form-grid--2col');

    const dirF = this.field(dirGrid, 'Direction');
    const dirSel = dirF.createEl('select', { cls: 'raid-form-select' });
    for (const [v, l] of [['inbound', 'Inbound'], ['outbound', 'Outbound'], ['external', 'External']]) {
      const opt = dirSel.createEl('option', { value: v, text: l });
      if (v === (this.data.dependencyDirection || 'inbound')) opt.selected = true;
    }
    dirSel.addEventListener('change', () => {
      this.data.dependencyDirection = dirSel.value as RaidItem['dependencyDirection'];
    });

    const contactF = this.field(dirGrid, 'Contact');
    const contactInput = contactF.createEl('input', { cls: 'raid-form-input' });
    contactInput.type = 'text';
    contactInput.placeholder = 'Responsible person / team…';
    contactInput.value = this.data.dependencyContact || '';
    contactInput.addEventListener('input', () => {
      this.data.dependencyContact = contactInput.value || undefined;
    });

    // Deadline always shown for dependencies
    const depMeta = body.createDiv('raid-form-grid--2col');

    const deadlineF = this.field(depMeta, 'Deadline');
    const dateInput = deadlineF.createEl('input', { cls: 'raid-form-input' });
    dateInput.type = 'datetime-local';
    const raw = this.data.deadline || '';
    dateInput.value = raw.length === 10 ? raw + 'T00:00'
      : raw.length >= 16 ? raw.slice(0, 16)
      : raw;
    dateInput.addEventListener('change', () => (this.data.deadline = dateInput.value || undefined));

    if (!DEP_DONE.has(status)) {
      const delayF = this.field(depMeta, 'Risk if delayed');
      const delayTA = delayF.createEl('textarea', { cls: 'raid-form-textarea raid-form-textarea--short' });
      delayTA.placeholder = 'Impact if this dependency is late…';
      delayTA.value = this.data.delayRisk || '';
      delayTA.addEventListener('input', () => (this.data.delayRisk = delayTA.value || undefined));
    }
  }

  // ── Shared field helpers ───────────────────────────────────────────────────

  private field(parent: HTMLElement, label: string, required = false): HTMLElement {
    const wrap = parent.createDiv('raid-form-field');
    const lbl  = wrap.createEl('label', { cls: 'raid-form-field__label' });
    lbl.createSpan({ text: label });
    if (required) lbl.createSpan({ text: ' *', cls: 'raid-form-field__required' });
    return wrap;
  }

  private divider(parent: HTMLElement, text: string): HTMLElement {
    const el = parent.createDiv('raid-form-section-divider');
    el.createEl('span', { text });
    return el;
  }

  /** Single-line text input bound to a string key on this.data */
  private inp(parent: HTMLElement, label: string, key: StringKey, placeholder: string) {
    const f = this.field(parent, label);
    const input = f.createEl('input', { cls: 'raid-form-input' });
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = (this.data[key] as string | undefined) || '';
    input.addEventListener('input', () => {
      (this.data as Record<string, unknown>)[key] = input.value || undefined;
    });
  }

  /** Textarea bound to a string key on this.data */
  private ta(parent: HTMLElement, label: string, key: StringKey, placeholder: string) {
    const f = this.field(parent, label);
    const ta = f.createEl('textarea', { cls: 'raid-form-textarea' });
    ta.placeholder = placeholder;
    ta.value = (this.data[key] as string | undefined) || '';
    ta.addEventListener('input', () => {
      (this.data as Record<string, unknown>)[key] = ta.value || undefined;
    });
  }

  private async submit() {
    if (!this.data.title?.trim()) { new Notice('Title is required.'); return; }
    if (!this.projectPath)        { new Notice('Select a project first.'); return; }
    try {
      if (this.item) {
        await this.plugin.store.updateItem(this.item.id, this.data);
        new Notice(`Updated ${this.item.id}`);
      } else {
        const created = await this.plugin.store.createItem(this.data, this.projectPath);
        new Notice(`Created ${created.id}`);
      }
      this.close();
    } catch (e) {
      new Notice(`Error: ${(e as Error).message}`);
    }
  }
}

// Helper type: keys of RaidItem whose value is string | undefined
type StringKey = keyof {
  [K in keyof RaidItem as RaidItem[K] extends string | undefined ? K : never]: RaidItem[K]
};
