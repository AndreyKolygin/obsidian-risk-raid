import { Plugin } from 'obsidian';
import type { RaidPluginSettings } from './types';
import { DEFAULT_SETTINGS, RAID_BOARD_VIEW_TYPE, RISK_MATRIX_VIEW_TYPE } from './constants';
import { RaidStore } from './store';
import { RaidBoardView } from './views/RaidBoardView';
import { RiskMatrixView } from './views/RiskMatrixView';
import { ItemFormModal } from './views/ItemFormModal';
import { CreateProjectModal } from './views/CreateProjectModal';
import { RaidSettingsTab } from './views/SettingsTab';

export default class RaidPlugin extends Plugin {
  settings: RaidPluginSettings = { ...DEFAULT_SETTINGS };
  store!: RaidStore;

  async onload() {
    await this.loadSettings();
    this.store = new RaidStore(this);

    this.registerView(RAID_BOARD_VIEW_TYPE,  (leaf) => new RaidBoardView(leaf, this));
    this.registerView(RISK_MATRIX_VIEW_TYPE, (leaf) => new RiskMatrixView(leaf, this));

    this.addCommand({
      id: 'open-raid-board', name: 'Open RAID Board',
      callback: () => this.activateView(RAID_BOARD_VIEW_TYPE),
    });
    this.addCommand({
      id: 'open-risk-matrix', name: 'Open Risk Matrix',
      callback: () => this.activateView(RISK_MATRIX_VIEW_TYPE),
    });
    this.addCommand({
      id: 'create-project', name: 'Create new project',
      callback: () => new CreateProjectModal(this.app, this, () => {}).open(),
    });
    this.addCommand({
      id: 'create-raid-item', name: 'Create new RAID item',
      callback: () => {
        const projects = this.store.getProjects();
        if (!projects.length) {
          new CreateProjectModal(this.app, this, (project) => {
            new ItemFormModal(this.app, this, project.filePath).open();
          }).open();
        } else {
          new ItemFormModal(this.app, this, projects[0].filePath).open();
        }
      },
    });

    this.addRibbonIcon('shield-alert', 'RAID Board', () => this.activateView(RAID_BOARD_VIEW_TYPE));
    this.addSettingTab(new RaidSettingsTab(this.app, this));

    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => this.store.onFileChanged(file)),
    );
    this.registerEvent(
      this.app.vault.on('delete', (file) => this.store.onFileDeleted(file)),
    );
    this.registerEvent(
      this.app.vault.on('create', (file) => this.store.onFileCreated(file)),
    );

    this.app.workspace.onLayoutReady(async () => {
      await this.store.initialize();
      if (this.settings.autoOpenOnStartup) {
        const viewType = this.settings.defaultView === 'matrix'
          ? RISK_MATRIX_VIEW_TYPE
          : RAID_BOARD_VIEW_TYPE;
        this.activateView(viewType);
      }
    });
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(RAID_BOARD_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(RISK_MATRIX_VIEW_TYPE);
  }

  async activateView(viewType: string) {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(viewType)[0];
    if (!leaf) {
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({ type: viewType, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
