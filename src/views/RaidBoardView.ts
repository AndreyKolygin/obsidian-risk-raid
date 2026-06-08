import { ItemView, TFile, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import type { RaidItem, RaidType, RaidProject } from '../types';
import { RAID_BOARD_VIEW_TYPE, RISK_MATRIX_VIEW_TYPE } from '../constants';
import { FilterBar } from '../components/FilterBar';
import { RaidBoard } from '../components/RaidBoard';
import { CreateProjectModal } from './CreateProjectModal';
import type RaidPlugin from '../main';

export class RaidBoardView extends ItemView {
  plugin: RaidPlugin;

  private activeProject: string | null = null;
  private activeType:    RaidType | 'all' = 'all';
  private activeStatus:  string = '';
  private searchQuery:   string = '';
  private ownerFilter:   string = '';

  private renderBound: () => void;

  constructor(leaf: WorkspaceLeaf, plugin: RaidPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.renderBound = this.render.bind(this);
  }

  getViewType():    string { return RAID_BOARD_VIEW_TYPE; }
  getDisplayText(): string { return 'RAID Board'; }
  getIcon():        string { return 'shield-alert'; }

  getState(): Record<string, unknown> {
    return { activeProject: this.activeProject };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    if (state && typeof state === 'object') {
      const s = state as Record<string, unknown>;
      if (typeof s.activeProject === 'string') this.activeProject = s.activeProject;
    }
    result.history = false;
    await this.render();
  }

  async onOpen() {
    this.plugin.store.on('change', this.renderBound);
    this.ensureActiveProject();
    await this.render();
  }

  async onClose() {
    this.plugin.store.off('change', this.renderBound);
  }

  private ensureActiveProject() {
    const projects = this.plugin.store.getProjects();
    if (!this.activeProject || !projects.find(p => p.filePath === this.activeProject)) {
      this.activeProject = projects[0]?.filePath ?? null;
    }
  }

  async render() {
    this.ensureActiveProject();

    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass('raid-view-container');

    const projects = this.plugin.store.getProjects();

    // View switcher
    this.renderViewSwitcher(root);

    // Project selector row
    this.renderProjectTabs(root, projects);

    if (!this.activeProject) {
      this.renderEmptyState(root);
      return;
    }

    const items = this.plugin.store.getItemsByProject(this.activeProject);

    this.renderSummaryStrip(root, items);

    new FilterBar(root, {
      activeType:    this.activeType,
      activeStatus:  this.activeStatus,
      searchQuery:   this.searchQuery,
      ownerFilter:   this.ownerFilter,
      onTypeChange:  (t) => { this.activeType = t; this.activeStatus = ''; this.render(); },
      onStatusChange:(s) => { this.activeStatus = s; this.render(); },
      onSearch:      (q) => { this.searchQuery = q; this.render(); },
      onOwnerFilter: (o) => { this.ownerFilter = o; this.render(); },
    }).render();

    new RaidBoard(root, this.applyFilters(items), this.plugin, this.activeType).render();

    const addBtn = root.createEl('button', { text: '+ New item', cls: 'raid-add-btn' });
    addBtn.addEventListener('click', async () => {
      if (!this.activeProject) return;
      const { ItemFormModal } = await import('./ItemFormModal');
      new ItemFormModal(this.plugin.app, this.plugin, this.activeProject).open();
    });
  }

  private renderViewSwitcher(root: HTMLElement) {
    const bar = root.createDiv('raid-view-switcher');
    const board = bar.createEl('button', { text: '📋 RAID Board', cls: 'raid-view-switch-btn raid-view-switch-btn--active' });
    board.disabled = true;
    const matrix = bar.createEl('button', { text: '📊 Risk Matrix', cls: 'raid-view-switch-btn' });
    matrix.addEventListener('click', () => this.plugin.activateView(RISK_MATRIX_VIEW_TYPE));
  }

  private renderProjectTabs(root: HTMLElement, projects: RaidProject[]) {
    const row = root.createDiv('raid-project-bar');

    for (const p of projects) {
      const tab = row.createEl('button', { text: p.name, cls: 'raid-project-tab' });
      if (this.activeProject === p.filePath) tab.addClass('raid-project-tab--active');
      tab.addEventListener('click', () => {
        this.activeProject = p.filePath;
        this.activeType    = 'all';
        this.activeStatus  = '';
        this.render();
      });

      // Open project file on double-click
      tab.addEventListener('dblclick', async () => {
        const file = this.plugin.app.vault.getAbstractFileByPath(p.filePath);
        if (file instanceof TFile) {
          await this.plugin.app.workspace.getLeaf(false).openFile(file);
        }
      });
    }

    const newBtn = row.createEl('button', { text: '+ New Project', cls: 'raid-project-tab raid-project-tab--new' });
    newBtn.addEventListener('click', () => {
      new CreateProjectModal(this.plugin.app, this.plugin, (project) => {
        this.activeProject = project.filePath;
        this.render();
      }).open();
    });
  }

  private renderEmptyState(root: HTMLElement) {
    const empty = root.createDiv('raid-empty-state raid-empty-state--full');
    empty.createEl('p', { text: 'No projects yet. Create your first project to get started.' });
    const btn = empty.createEl('button', { text: '+ Create Project', cls: 'mod-cta' });
    btn.addEventListener('click', () => {
      new CreateProjectModal(this.plugin.app, this.plugin, (project) => {
        this.activeProject = project.filePath;
        this.render();
      }).open();
    });
  }

  private renderSummaryStrip(root: HTMLElement, items: RaidItem[]) {
    const strip = root.createDiv('raid-summary-strip');
    const risks   = items.filter(i => i.type === 'risk');
    const assmpts = items.filter(i => i.type === 'assumption');
    const issues  = items.filter(i => i.type === 'issue');
    const deps    = items.filter(i => i.type === 'dependency');

    const critical  = risks.filter(i => i.severity === 'critical').length;
    const unconf    = assmpts.filter(i => i.status === 'unconfirmed').length;
    const blockers  = issues.filter(i => i.status === 'blocker').length;
    const external  = deps.filter(i => i.dependencyDirection === 'external').length;

    this.summaryCard(strip, 'R', 'risk',       'Risks',        risks.length,
      critical ? `${critical} critical` : 'no critical');
    this.summaryCard(strip, 'A', 'assumption', 'Assumptions',  assmpts.length,
      unconf   ? `${unconf} unconfirmed` : 'all confirmed');
    this.summaryCard(strip, 'I', 'issue',      'Issues',       issues.length,
      blockers ? `${blockers} blocker${blockers > 1 ? 's' : ''}` : 'no blockers');
    this.summaryCard(strip, 'D', 'dependency', 'Dependencies', deps.length,
      external ? `${external} external` : 'no external');
  }

  private summaryCard(
    strip: HTMLElement,
    letter: string,
    type: string,
    label: string,
    count: number,
    sub: string,
  ) {
    const raidType = type as RaidType;
    const isActive = this.activeType === raidType;
    const card = strip.createEl('button', { cls: `raid-summary-card raid-summary-card--${type}${isActive ? ' raid-summary-card--active' : ''}` });
    card.createDiv({ text: letter,        cls: 'raid-summary-card__letter' });
    card.createDiv({ text: String(count), cls: 'raid-summary-card__count' });
    const info = card.createDiv('raid-summary-card__info');
    info.createDiv({ text: label, cls: 'raid-summary-card__label' });
    info.createDiv({ text: sub,   cls: 'raid-summary-card__subtitle' });
    card.addEventListener('click', () => {
      this.activeType   = isActive ? 'all' : raidType;
      this.activeStatus = '';
      this.render();
    });
  }

  private applyFilters(items: RaidItem[]): RaidItem[] {
    let r = items;
    if (this.activeType !== 'all')
      r = r.filter(i => i.type === this.activeType);
    if (this.activeStatus)
      r = r.filter(i => i.status === this.activeStatus);
    if (this.ownerFilter)
      r = r.filter(i => i.owner.toLowerCase().includes(this.ownerFilter.toLowerCase()));
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      r = r.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q),
      );
    }
    return r;
  }
}
