import { Menu, TFile } from 'obsidian';
import type { RaidItem, Probability, Impact } from '../types';
import type RaidPlugin from '../main';
import { ItemCard } from './ItemCard';

const PROBABILITIES: Probability[] = ['high', 'medium', 'low'];
const IMPACTS:       Impact[]      = ['low', 'medium', 'high'];

const CELL_SEVERITY: Record<Probability, Record<Impact, string>> = {
  high:   { low: 'medium', medium: 'high',   high: 'critical' },
  medium: { low: 'low',    medium: 'medium',  high: 'high'     },
  low:    { low: 'low',    medium: 'low',     high: 'medium'   },
};

export class RiskMatrix {
  private container: HTMLElement;
  private risks: RaidItem[];
  private plugin: RaidPlugin;

  private selectedRisk:      RaidItem | null    = null;
  private selectedContainer!: HTMLElement;
  private activeBubble:      HTMLElement | null = null;

  constructor(container: HTMLElement, risks: RaidItem[], plugin: RaidPlugin) {
    this.container = container;
    this.risks = risks;
    this.plugin = plugin;
  }

  render() {
    const wrapper = this.container.createDiv('raid-matrix-container');
    wrapper.createEl('h2', { text: 'Risk Matrix', cls: 'raid-matrix-title' });

    const gridWrapper = wrapper.createDiv('raid-matrix-grid-wrapper');

    // Y-axis label (rotated via CSS)
    const yAxis = gridWrapper.createDiv('raid-matrix-y-axis');
    yAxis.createEl('span', { text: '← Probability', cls: 'raid-matrix-axis-label' });

    const gridArea = gridWrapper.createDiv('raid-matrix-grid-area');

    // Y labels column
    const yLabels = gridArea.createDiv('raid-matrix-y-labels');
    for (const p of PROBABILITIES) {
      yLabels.createEl('div', {
        text: p.charAt(0).toUpperCase() + p.slice(1),
        cls:  'raid-matrix-y-label',
      });
    }

    // Grid (3 rows × 3 cols)
    const grid = gridArea.createDiv('raid-matrix-grid');
    for (const prob of PROBABILITIES) {
      for (const imp of IMPACTS) {
        const severity = CELL_SEVERITY[prob][imp];
        const cell = grid.createDiv(`raid-matrix-cell raid-matrix-cell--${severity}`);
        const cellRisks = this.risks.filter(r => r.probability === prob && r.impact === imp);
        const visible  = cellRisks.slice(0, 3);
        const hidden   = cellRisks.slice(3);

        for (const risk of visible) this.renderBubble(cell, risk);

        if (hidden.length > 0) {
          // Render hidden bubbles collapsed; they become interactive when expanded
          const hiddenEls = hidden.map(r => {
            const el = this.renderBubble(cell, r);
            el.addClass('raid-matrix-bubble--collapsed');
            return el;
          });

          let expanded = false;
          const overflowBtn = cell.createDiv({
            text: `+${hidden.length}`,
            cls: 'raid-matrix-bubble raid-matrix-bubble--overflow',
          });
          overflowBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            expanded = !expanded;
            for (const el of hiddenEls) el.toggleClass('raid-matrix-bubble--collapsed', !expanded);
            overflowBtn.setText(expanded ? '▲' : `+${hidden.length}`);
          });
        }
      }
    }

    // X labels row
    const xLabels = gridArea.createDiv('raid-matrix-x-labels');
    for (const imp of IMPACTS) {
      xLabels.createEl('div', {
        text: imp.charAt(0).toUpperCase() + imp.slice(1),
        cls:  'raid-matrix-x-label',
      });
    }
    gridArea.createEl('div', { text: 'Impact →', cls: 'raid-matrix-x-axis-label' });

    // Unplotted notice
    const unplotted = this.risks.filter(r => !r.probability || !r.impact);
    if (unplotted.length > 0) {
      const notice = wrapper.createDiv('raid-matrix-unplotted');
      notice.createEl('strong', { text: `${unplotted.length} risk(s) not plotted` });
      notice.createEl('span', { text: ' — missing probability/impact. Click to edit:' });
      for (const r of unplotted) {
        const chip = notice.createEl('span', { text: r.id, cls: 'raid-matrix-unplotted-chip' });
        chip.addEventListener('click', async () => {
          const { ItemFormModal } = await import('../views/ItemFormModal');
          new ItemFormModal(this.plugin.app, this.plugin, r.filePath, r).open();
        });
      }
    }

    // Legend
    const legend = wrapper.createDiv('raid-matrix-legend');
    for (const s of ['critical', 'high', 'medium', 'low'] as const) {
      const row = legend.createDiv('raid-matrix-legend-item');
      row.createDiv(`raid-matrix-legend-color raid-matrix-legend-color--${s}`);
      row.createEl('span', { text: s.charAt(0).toUpperCase() + s.slice(1) });
    }

    // Selected risk card panel (populated on bubble click)
    this.selectedContainer = wrapper.createDiv('raid-matrix-selected');
  }

  private renderBubble(cell: HTMLElement, risk: RaidItem): HTMLElement {
    const bubble = cell.createDiv('raid-matrix-bubble');
    bubble.setText(risk.id);
    bubble.title = [
      risk.title,
      `Owner: ${risk.owner}`,
      `Status: ${risk.status}`,
      risk.mitigation ? `Mitigation: ${risk.mitigation}` : '',
    ].filter(Boolean).join('\n');

    bubble.addEventListener('click', () => {
      this.showCard(risk, bubble);
    });

    bubble.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      const { ItemFormModal } = await import('../views/ItemFormModal');
      const menu = new Menu();
      menu.addItem(i =>
        i.setTitle('Edit item').setIcon('pencil').onClick(() => {
          new ItemFormModal(this.plugin.app, this.plugin, risk.filePath, risk).open();
        }),
      );
      menu.addItem(i =>
        i.setTitle('Open note').setIcon('file-text').onClick(async () => {
          const file = this.plugin.app.vault.getAbstractFileByPath(risk.filePath);
          if (file instanceof TFile) {
            await this.plugin.app.workspace.getLeaf(false).openFile(file);
          }
        }),
      );
      menu.showAtMouseEvent(e);
    });

    return bubble;
  }

  private showCard(risk: RaidItem, bubble: HTMLElement) {
    this.selectedContainer.empty();

    // Toggle off if same bubble clicked again
    if (this.selectedRisk?.id === risk.id) {
      this.selectedRisk = null;
      this.activeBubble?.removeClass('raid-matrix-bubble--active');
      this.activeBubble = null;
      return;
    }

    // Update active bubble
    this.activeBubble?.removeClass('raid-matrix-bubble--active');
    bubble.addClass('raid-matrix-bubble--active');
    this.activeBubble = bubble;
    this.selectedRisk = risk;

    new ItemCard(this.selectedContainer, risk, this.plugin).render();

    // Scroll the container into view smoothly
    this.selectedContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
