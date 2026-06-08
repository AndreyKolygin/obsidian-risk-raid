import { App, TFile } from 'obsidian';

export async function ensureFolder(app: App, folderPath: string): Promise<void> {
  if (!app.vault.getAbstractFileByPath(folderPath)) {
    await app.vault.createFolder(folderPath);
  }
}

export async function readFile(app: App, path: string): Promise<string | null> {
  const file = app.vault.getAbstractFileByPath(path);
  if (file instanceof TFile) return await app.vault.read(file);
  return null;
}

export async function deleteFile(app: App, path: string): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path);
  if (file) await app.vault.delete(file);
}
