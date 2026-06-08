import { App, PluginSettingTab, Setting } from 'obsidian';
import type RaidPlugin from '../main';

export class RaidSettingsTab extends PluginSettingTab {
  plugin: RaidPlugin;

  constructor(app: App, plugin: RaidPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Risk RAID Settings' });

    new Setting(containerEl)
      .setName('RAID Folder')
      .setDesc('Vault folder where RAID items are stored')
      .addText(t => {
        t.setPlaceholder('RAID').setValue(this.plugin.settings.raidFolder);
        t.onChange(async v => {
          this.plugin.settings.raidFolder = v.trim() || 'RAID';
          await this.plugin.saveSettings();
          await this.plugin.store.initialize();
        });
      });

    new Setting(containerEl)
      .setName('Default View')
      .setDesc('Which view opens by default')
      .addDropdown(d => {
        d.addOption('board',  'RAID Board');
        d.addOption('matrix', 'Risk Matrix');
        d.setValue(this.plugin.settings.defaultView);
        d.onChange(async v => {
          this.plugin.settings.defaultView = v as 'board' | 'matrix';
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Auto-open on startup')
      .setDesc('Open the default view when Obsidian starts')
      .addToggle(t => {
        t.setValue(this.plugin.settings.autoOpenOnStartup);
        t.onChange(async v => {
          this.plugin.settings.autoOpenOnStartup = v;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Show severity colors')
      .setDesc('Color-code items by severity level')
      .addToggle(t => {
        t.setValue(this.plugin.settings.showSeverityColors);
        t.onChange(async v => {
          this.plugin.settings.showSeverityColors = v;
          await this.plugin.saveSettings();
          this.plugin.store.refresh();
        });
      });

    // ── Owners ────────────────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName('Owners')
      .setDesc('Default owner list for autocomplete in forms. Sorted alphabetically.');

    const ownerList = containerEl.createDiv('raid-settings-owner-list');
    this.renderList(ownerList, {
      getItems:    () => this.plugin.settings.customOwners,
      removeItem:  async (v) => {
        this.plugin.settings.customOwners =
          this.plugin.settings.customOwners.filter(o => o !== v);
        await this.plugin.saveSettings();
      },
      addItem:     async (v) => {
        this.plugin.settings.customOwners.push(v);
        await this.plugin.saveSettings();
      },
      placeholder: 'New owner name…',
      emptyText:   'No owners yet. Add your first owner below.',
    });

    // ── Tags ──────────────────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName('Tags')
      .setDesc('Tag library used for autocomplete. New tags added in forms appear here automatically.');

    const tagList = containerEl.createDiv('raid-settings-owner-list');
    this.renderList(tagList, {
      getItems:    () => this.plugin.settings.customTags,
      removeItem:  async (v) => {
        this.plugin.settings.customTags =
          this.plugin.settings.customTags.filter(t => t !== v);
        await this.plugin.saveSettings();
      },
      addItem:     async (v) => {
        const tag = v.toLowerCase().replace(/\s+/g, '-');
        if (!this.plugin.settings.customTags.includes(tag)) {
          this.plugin.settings.customTags.push(tag);
          await this.plugin.saveSettings();
        }
      },
      placeholder: 'New tag…',
      emptyText:   'No tags yet. Tags are added automatically when you create items.',
    });
  }

  private renderList(container: HTMLElement, opts: {
    getItems:    () => string[];
    removeItem:  (v: string) => Promise<void>;
    addItem:     (v: string) => Promise<void>;
    placeholder: string;
    emptyText:   string;
  }) {
    container.empty();

    const sorted = [...opts.getItems()].sort((a, b) => a.localeCompare(b));

    if (sorted.length === 0) {
      container.createEl('p', { text: opts.emptyText, cls: 'raid-settings-owner-empty' });
    }

    for (const item of sorted) {
      const row = container.createDiv('raid-settings-owner-row');
      row.createEl('span', { text: item, cls: 'raid-settings-owner-name' });
      const del = row.createEl('button', { text: '✕', cls: 'raid-settings-owner-remove' });
      del.title = 'Remove';
      del.addEventListener('click', async () => {
        await opts.removeItem(item);
        this.renderList(container, opts);
      });
    }

    const addRow = container.createDiv('raid-settings-owner-add-row');
    const input  = addRow.createEl('input', { cls: 'raid-settings-owner-input' });
    input.type        = 'text';
    input.placeholder = opts.placeholder;
    const addBtn = addRow.createEl('button', { text: 'Add', cls: 'mod-cta raid-settings-owner-btn' });

    const doAdd = async () => {
      const val = input.value.trim();
      if (!val) return;
      await opts.addItem(val);
      input.value = '';
      this.renderList(container, opts);
    };

    addBtn.addEventListener('click', doAdd);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
  }
}
