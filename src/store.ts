import { TAbstractFile, TFile, normalizePath } from 'obsidian';
import type { RaidItem, RaidType, RaidProject, HistoryEntry } from './types';
import {
  parseProjectFrontmatter,
  parseRaidItemsFromBody,
  serializeItemProps,
  addItemToContent,
  updateItemInContent,
  deleteItemFromContent,
  buildProjectFileContent,
  slugify,
} from './parser';
import { SEVERITY_MATRIX, TYPE_PREFIXES } from './constants';
import type RaidPlugin from './main';

// ─── Human-readable diff ─────────────────────────────────────────────────────

const DIFF_VALUE_FIELDS: Array<keyof RaidItem> = [
  'status', 'probability', 'impact', 'dependencyDirection', 'owner', 'deadline', 'title',
];
const DIFF_TEXT_FIELDS: Array<keyof RaidItem> = [
  'description', 'mitigation', 'action', 'dependencyContact',
  'reasoning', 'ifWrong', 'source', 'recorded', 'assumptionRisk',
  'issueImpact', 'solution', 'delayRisk', 'probabilityNote', 'impactNote',
];
const DIFF_LABELS: Partial<Record<keyof RaidItem, string>> = {
  status: 'Status', probability: 'Probability', impact: 'Impact',
  dependencyDirection: 'Direction', owner: 'Owner', deadline: 'Deadline',
  title: 'Title', description: 'Description', mitigation: 'Mitigation',
  action: 'Action', dependencyContact: 'Contact', reasoning: 'Reasoning',
  ifWrong: 'If wrong', source: 'Source', recorded: 'Recorded',
  assumptionRisk: 'Risk (assumption)', issueImpact: 'Impact (issue)',
  solution: 'Solution', delayRisk: 'Risk if delayed',
  probabilityNote: 'Probability note', impactNote: 'Impact note',
};

function computeChanges(prev: RaidItem, next: RaidItem): string[] {
  const out: string[] = [];

  for (const f of DIFF_VALUE_FIELDS) {
    const a = prev[f], b = next[f];
    if (a === b) continue;
    const label = DIFF_LABELS[f] ?? String(f);
    if (!a)      out.push(`${label}: added "${b}"`);
    else if (!b) out.push(`${label}: removed`);
    else         out.push(`${label}: ${a} → ${b}`);
  }

  for (const f of DIFF_TEXT_FIELDS) {
    const a = prev[f], b = next[f];
    if (a === b) continue;
    const label = DIFF_LABELS[f] ?? String(f);
    if (!a)      out.push(`${label} added`);
    else if (!b) out.push(`${label} removed`);
    else         out.push(`${label} updated`);
  }

  const at = prev.tags?.join(',') ?? '';
  const bt = next.tags?.join(',') ?? '';
  if (at !== bt) out.push('Tags updated');

  const al = prev.linkedItems?.join(',') ?? '';
  const bl = next.linkedItems?.join(',') ?? '';
  if (al !== bl) out.push('Linked items updated');

  return out;
}

type ChangeListener = () => void;

export class RaidStore {
  private items:    Map<string, RaidItem>   = new Map();
  private projects: Map<string, RaidProject> = new Map();
  private plugin:   RaidPlugin;
  private changeListeners: Set<ChangeListener> = new Set();
  private writingFiles:    Set<string>          = new Set();

  constructor(plugin: RaidPlugin) {
    this.plugin = plugin;
  }

  on(_event: 'change', listener: ChangeListener): void  { this.changeListeners.add(listener);    }
  off(_event: 'change', listener: ChangeListener): void { this.changeListeners.delete(listener); }
  private emit(): void { this.changeListeners.forEach(l => l()); }
  refresh(): void { this.emit(); }

  // ─── Initialize ─────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    this.items.clear();
    this.projects.clear();

    const folder = this.plugin.settings.raidFolder;
    const prefix = folder.endsWith('/') ? folder : folder + '/';
    const files = this.plugin.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith(prefix));

    for (const file of files) {
      await this.indexProjectFile(file);
    }

    await this.syncTagsToSettings();
    this.emit();
  }

  private async syncTagsToSettings(): Promise<void> {
    const known = new Set(this.plugin.settings.customTags);
    for (const item of this.items.values()) {
      for (const tag of item.tags ?? []) known.add(tag);
    }
    const merged = [...known].sort((a, b) => a.localeCompare(b));
    if (merged.join(',') !== [...this.plugin.settings.customTags].sort().join(',')) {
      this.plugin.settings.customTags = merged;
      await this.plugin.saveSettings();
    }
  }

  private async indexProjectFile(file: TFile): Promise<boolean> {
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    const fm    = cache?.frontmatter;
    if (!fm) return false;

    const project = parseProjectFrontmatter(fm, file.path);
    if (!project) return false;

    this.projects.set(file.path, project);

    // Remove stale items for this file before re-indexing
    for (const [id, item] of this.items.entries()) {
      if (item.filePath === file.path) this.items.delete(id);
    }

    const content = await this.plugin.app.vault.read(file);
    const items   = parseRaidItemsFromBody(content, file.path);
    for (const item of items) this.items.set(item.id, item);

    return true;
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async createItem(data: Partial<RaidItem>, projectPath: string): Promise<RaidItem> {
    const type = data.type!;
    const id   = this.nextId(type);
    const now  = new Date().toISOString();

    const probability = data.probability;
    const impact      = data.impact;
    const severity    = probability && impact
      ? SEVERITY_MATRIX[probability][impact]
      : undefined;

    const defaultStatus = ((): RaidItem['status'] => {
      if (type === 'risk')        return 'open';
      if (type === 'assumption')  return 'unconfirmed';
      if (type === 'issue')       return 'open';
      return 'pending';
    })();

    const item: RaidItem = {
      id, type,
      title:               data.title || '',
      probability,
      probabilityNote:     data.probabilityNote,
      impact,
      impactNote:          data.impactNote,
      severity,
      status:              data.status || defaultStatus,
      owner:               data.owner || '',
      description:         data.description || '',
      mitigation:          data.mitigation,
      action:              data.action,
      deadline:            data.deadline,
      linkedItems:         data.linkedItems,
      tags:                data.tags,
      dependencyDirection: data.dependencyDirection,
      dependencyContact:   data.dependencyContact,
      reasoning:           data.reasoning,
      ifWrong:             data.ifWrong,
      source:              data.source,
      recorded:            data.recorded,
      assumptionRisk:      data.assumptionRisk,
      issueImpact:         data.issueImpact,
      solution:            data.solution,
      delayRisk:           data.delayRisk,
      history: [{ date: now, changes: ['Item created'] }],
      createdAt:           now,
      updatedAt:           now,
      filePath:            projectPath,
    };

    const file = this.plugin.app.vault.getAbstractFileByPath(projectPath) as TFile | null;
    if (!file) throw new Error(`Project file not found: ${projectPath}`);

    const content    = await this.plugin.app.vault.read(file);
    const newContent = addItemToContent(content, item);
    this.writingFiles.add(projectPath);
    await this.plugin.app.vault.modify(file, newContent);

    this.items.set(id, item);
    this.emit();
    return item;
  }

  async updateItem(id: string, data: Partial<RaidItem>): Promise<RaidItem> {
    const existing = this.items.get(id);
    if (!existing) throw new Error(`Item ${id} not found`);

    const probability = data.probability ?? existing.probability;
    const impact      = data.impact      ?? existing.impact;
    const severity    = probability && impact
      ? SEVERITY_MATRIX[probability][impact]
      : existing.severity;

    const now     = new Date().toISOString();
    const merged: RaidItem = { ...existing, ...data, severity, updatedAt: now };

    const changes = computeChanges(existing, merged);
    const newEntry: HistoryEntry = { date: now, changes: changes.length ? changes : ['Updated'] };
    const updated: RaidItem = {
      ...merged,
      history: [...(existing.history ?? []), newEntry],
    };

    const file = this.plugin.app.vault.getAbstractFileByPath(existing.filePath) as TFile | null;
    if (!file) throw new Error(`File not found: ${existing.filePath}`);

    const content    = await this.plugin.app.vault.read(file);
    const newContent = updateItemInContent(content, updated);
    this.writingFiles.add(existing.filePath);
    await this.plugin.app.vault.modify(file, newContent);

    this.items.set(id, updated);
    this.emit();
    return updated;
  }

  async deleteItem(id: string): Promise<void> {
    const item = this.items.get(id);
    if (!item) return;

    const file = this.plugin.app.vault.getAbstractFileByPath(item.filePath) as TFile | null;
    if (file) {
      const content    = await this.plugin.app.vault.read(file);
      const newContent = deleteItemFromContent(content, id);
      this.writingFiles.add(item.filePath);
      await this.plugin.app.vault.modify(file, newContent);
    }

    this.items.delete(id);
    this.emit();
  }

  async createProject(name: string): Promise<RaidProject> {
    const folder = this.plugin.settings.raidFolder;
    if (!this.plugin.app.vault.getAbstractFileByPath(folder)) {
      await this.plugin.app.vault.createFolder(folder);
    }

    const fileName = `${slugify(name) || 'project'}.md`;
    const filePath = normalizePath(`${folder}/${fileName}`);
    const content  = buildProjectFileContent(name);

    this.writingFiles.add(filePath);
    await this.plugin.app.vault.create(filePath, content);

    const project: RaidProject = { name, filePath };
    this.projects.set(filePath, project);
    this.emit();
    return project;
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

  getProjects():                        RaidProject[] { return Array.from(this.projects.values()); }
  getAll():                             RaidItem[]    { return Array.from(this.items.values());    }
  getById(id: string):                  RaidItem | undefined { return this.items.get(id);         }
  getByType(type: RaidType):            RaidItem[]    { return this.getAll().filter(i => i.type === type);   }
  getByStatus(status: string):          RaidItem[]    { return this.getAll().filter(i => i.status === status); }
  getCritical():                        RaidItem[]    { return this.getAll().filter(i => i.severity === 'critical'); }
  getBlockers():                        RaidItem[]    { return this.getAll().filter(i => i.type === 'issue' && i.status === 'blocker'); }
  getItemsByProject(path: string):      RaidItem[]    { return this.getAll().filter(i => i.filePath === path); }

  // ─── Vault event handlers ─────────────────────────────────────────────────────

  async onFileChanged(file: TFile): Promise<void> {
    const folder = this.plugin.settings.raidFolder;
    const prefix = folder.endsWith('/') ? folder : folder + '/';
    if (!file.path.startsWith(prefix)) return;

    // Suppress re-parse when we just wrote this file
    if (this.writingFiles.has(file.path)) {
      this.writingFiles.delete(file.path);
      return;
    }

    const changed = await this.indexProjectFile(file);
    if (changed) this.emit();
  }

  onFileDeleted(file: TAbstractFile): void {
    const folder = this.plugin.settings.raidFolder;
    const prefix = folder.endsWith('/') ? folder : folder + '/';
    if (!file.path.startsWith(prefix)) return;

    this.projects.delete(file.path);
    for (const [id, item] of this.items.entries()) {
      if (item.filePath === file.path) this.items.delete(id);
    }
    this.emit();
  }

  async onFileCreated(file: TAbstractFile): Promise<void> {
    if (!(file instanceof TFile)) return;
    const folder = this.plugin.settings.raidFolder;
    const prefix = folder.endsWith('/') ? folder : folder + '/';
    if (!file.path.startsWith(prefix)) return;

    if (this.writingFiles.has(file.path)) {
      this.writingFiles.delete(file.path);
      return;
    }

    const changed = await this.indexProjectFile(file);
    if (changed) this.emit();
  }

  // ─── ID generation ───────────────────────────────────────────────────────────

  private nextId(type: RaidType): string {
    const prefix  = TYPE_PREFIXES[type];
    const nums    = this.getByType(type)
      .map(i => parseInt(i.id.split('-')[1]))
      .filter(n => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `${prefix}-${String(next).padStart(3, '0')}`;
  }
}
