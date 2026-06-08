import { ItemView, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import type { RaidProject } from '../types';
import { RAID_BOARD_VIEW_TYPE, RISK_MATRIX_VIEW_TYPE } from '../constants';
import { RiskMatrix } from '../components/RiskMatrix';
import { CreateProjectModal } from './CreateProjectModal';
import type RaidPlugin from '../main';

export class RiskMatrixView extends ItemView {
  plugin: RaidPlugin;
  private activeProject: string | null = null;
  private renderBound: () => void;

  constructor(leaf: WorkspaceLeaf, plugin: RaidPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.renderBound = this.render.bind(this);
  }

  getViewType():    string { return RISK_MATRIX_VIEW_TYPE; }
  getDisplayText(): string { return 'Risk Matrix'; }
  getIcon():        string { return 'grid'; }

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

    this.renderViewSwitcher(root);
    this.renderProjectTabs(root, projects);

    if (!this.activeProject) {
      root.createEl('p', {
        text: 'No projects yet.',
        cls: 'raid-empty-state',
      });
      return;
    }

    const risks = this.plugin.store
      .getItemsByProject(this.activeProject)
      .filter(i => i.type === 'risk');

    new RiskMatrix(root, risks, this.plugin).render();
  }

  private renderViewSwitcher(root: HTMLElement) {
    const bar = root.createDiv('raid-view-switcher');
    const board = bar.createEl('button', { text: '📋 RAID Board', cls: 'raid-view-switch-btn' });
    board.addEventListener('click', () => this.plugin.activateView(RAID_BOARD_VIEW_TYPE));
    const matrix = bar.createEl('button', { text: '📊 Risk Matrix', cls: 'raid-view-switch-btn raid-view-switch-btn--active' });
    matrix.disabled = true;
  }

  private renderProjectTabs(root: HTMLElement, projects: RaidProject[]) {
    const row = root.createDiv('raid-project-bar');

    for (const p of projects) {
      const tab = row.createEl('button', { text: p.name, cls: 'raid-project-tab' });
      if (this.activeProject === p.filePath) tab.addClass('raid-project-tab--active');
      tab.addEventListener('click', () => {
        this.activeProject = p.filePath;
        this.render();
      });
    }

    const newBtn = row.createEl('button', {
      text: '+ New Project',
      cls:  'raid-project-tab raid-project-tab--new',
    });
    newBtn.addEventListener('click', () => {
      new CreateProjectModal(this.plugin.app, this.plugin, (project) => {
        this.activeProject = project.filePath;
        this.render();
      }).open();
    });
  }
}
