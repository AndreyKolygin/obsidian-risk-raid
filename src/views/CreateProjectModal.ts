import { App, Modal, Notice, Setting } from 'obsidian';
import type { RaidProject } from '../types';
import type RaidPlugin from '../main';

export class CreateProjectModal extends Modal {
  private plugin: RaidPlugin;
  private name = '';
  private onCreated: (project: RaidProject) => void;

  constructor(app: App, plugin: RaidPlugin, onCreated: (project: RaidProject) => void) {
    super(app);
    this.plugin  = plugin;
    this.onCreated = onCreated;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'New Project' });

    new Setting(contentEl)
      .setName('Project name')
      .addText(t => {
        t.setPlaceholder('Alpha Release');
        t.onChange(v => (this.name = v));
        t.inputEl.addEventListener('keydown', e => {
          if (e.key === 'Enter') this.submit();
        });
        // autofocus
        setTimeout(() => t.inputEl.focus(), 50);
      });

    const row = contentEl.createDiv('raid-form-buttons');
    row.createEl('button', { text: 'Create', cls: 'mod-cta' })
       .addEventListener('click', () => this.submit());
    row.createEl('button', { text: 'Cancel' })
       .addEventListener('click', () => this.close());
  }

  onClose() { this.contentEl.empty(); }

  private async submit() {
    if (!this.name.trim()) { new Notice('Project name is required.'); return; }
    try {
      const project = await this.plugin.store.createProject(this.name.trim());
      this.onCreated(project);
      this.close();
    } catch (e) {
      new Notice(`Error: ${(e as Error).message}`);
    }
  }
}
