import { parseYaml, stringifyYaml } from 'obsidian';
import type {
  RaidItem, RaidType, RaidStatus, RaidProject,
  Probability, Impact, Severity, DependencyDirection, HistoryEntry,
} from './types';
import { SEVERITY_MATRIX } from './constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_MAP: Record<string, RaidType> = {
  R: 'risk', A: 'assumption', I: 'issue', D: 'dependency',
};

const DEFAULT_STATUS: Record<RaidType, RaidStatus> = {
  risk:       'open',
  assumption: 'unconfirmed',
  issue:      'open',
  dependency: 'pending',
};

function yamlToStr(val: unknown): string | undefined {
  if (val === null || val === undefined) return undefined;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function yamlToDateStr(val: unknown): string | undefined {
  if (val === null || val === undefined) return undefined;
  if (val instanceof Date) {
    // Preserve time: return YYYY-MM-DDTHH:MM
    return val.toISOString().slice(0, 16);
  }
  const s = String(val);
  // If already contains time, normalise to YYYY-MM-DDTHH:MM
  return s.includes('T') ? s.slice(0, 16) : s;
}

// ─── Project frontmatter ───────────────────────────────────────────────────────

export function parseProjectFrontmatter(
  fm: Record<string, unknown>,
  filePath: string,
): RaidProject | null {
  if (!fm['project-name']) return null;
  return { name: String(fm['project-name']), filePath };
}

// ─── Build new project file ────────────────────────────────────────────────────

export function buildProjectFileContent(name: string): string {
  const fm = stringifyYaml({ 'project-name': name });
  return `---\n${fm}---\n\n# ${name} — RAID Log\n`;
}

// ─── Parse items from file body ────────────────────────────────────────────────

export function parseRaidItemsFromBody(content: string, filePath: string): RaidItem[] {
  const items: RaidItem[] = [];

  // Strip frontmatter so we don't accidentally match ## inside it
  const bodyStart = content.indexOf('\n---\n', 3);
  const body = bodyStart >= 0 ? content.slice(bodyStart + 5) : content;

  // Split at each \n## boundary; the \n is consumed, sections start with "## "
  const sections = body.split(/\n(?=## )/);

  for (const section of sections) {
    const headingMatch = section.match(/^## ([RAID]-\d+) (.+)\n/);
    if (!headingMatch) continue;

    const id    = headingMatch[1];
    const title = headingMatch[2].trim();
    const type  = TYPE_MAP[id[0]];
    if (!type) continue;

    // Find first ```raid ... ``` block in this section
    const codeMatch = section.match(/```raid\n([\s\S]*?)```/);
    if (!codeMatch) continue;

    let props: Record<string, unknown> = {};
    try {
      const parsed = parseYaml(codeMatch[1]);
      if (parsed && typeof parsed === 'object') props = parsed as Record<string, unknown>;
    } catch {
      continue;
    }

    const probability = props.probability as Probability | undefined;
    const impact      = props.impact      as Impact      | undefined;
    let   severity    = props.severity    as Severity    | undefined;
    if (!severity && probability && impact) {
      severity = SEVERITY_MATRIX[probability][impact];
    }

    items.push({
      id,
      type,
      title,
      probability,
      probabilityNote: props['probability-note'] ? String(props['probability-note']) : undefined,
      impact,
      impactNote: props['impact-note'] ? String(props['impact-note']) : undefined,
      severity,
      status:    (props.status as RaidStatus)  || DEFAULT_STATUS[type],
      owner:     String(props.owner || ''),
      description: String(props.description || ''),
      mitigation:  props.mitigation         ? String(props.mitigation)          : undefined,
      action:      props.action             ? String(props.action)              : undefined,
      deadline:    props.deadline           ? yamlToDateStr(props.deadline)     : undefined,
      linkedItems: Array.isArray(props['linked-items'])
        ? (props['linked-items'] as unknown[]).map(String)
        : undefined,
      tags: Array.isArray(props.tags)
        ? (props.tags as unknown[]).map(String)
        : undefined,
      dependencyDirection: props['dependency-direction'] as DependencyDirection | undefined,
      dependencyContact:   props['dependency-contact']
        ? String(props['dependency-contact'])
        : undefined,
      // Assumption fields
      reasoning:      props.reasoning       ? String(props.reasoning)      : undefined,
      ifWrong:        props['if-wrong']     ? String(props['if-wrong'])    : undefined,
      source:         props.source          ? String(props.source)         : undefined,
      recorded:       props.recorded        ? String(props.recorded)       : undefined,
      assumptionRisk: props['assumption-risk'] ? String(props['assumption-risk']) : undefined,
      // Issue fields
      issueImpact:    props['issue-impact'] ? String(props['issue-impact']) : undefined,
      solution:       props.solution        ? String(props.solution)        : undefined,
      // Dependency fields
      delayRisk:      props['delay-risk']   ? String(props['delay-risk'])  : undefined,
      // History
      history: Array.isArray(props.history)
        ? (props.history as unknown[]).flatMap((e: unknown): HistoryEntry[] => {
            if (!e || typeof e !== 'object') return [];
            const entry = e as Record<string, unknown>;
            return [{
              date:    yamlToStr(entry.date) ?? '',
              changes: Array.isArray(entry.changes)
                ? (entry.changes as unknown[]).map(String)
                : [],
            }];
          }).filter(e => e.date)
        : undefined,
      createdAt: yamlToStr(props['created-at']) || new Date().toISOString(),
      updatedAt: yamlToStr(props['updated-at']) || new Date().toISOString(),
      filePath,
    });
  }

  return items;
}

// ─── Serialize item props to YAML (for ```raid block) ─────────────────────────

export function serializeItemProps(item: RaidItem): string {
  const p: Record<string, unknown> = {};

  if (item.type === 'risk') {
    if (item.probability)     p.probability          = item.probability;
    if (item.probabilityNote) p['probability-note']  = item.probabilityNote;
    if (item.impact)          p.impact               = item.impact;
    if (item.impactNote)      p['impact-note']        = item.impactNote;
    if (item.severity)        p.severity             = item.severity;
  }

  p.status = item.status;
  p.owner  = item.owner;

  if (item.description)         p.description              = item.description;
  if (item.mitigation)          p.mitigation               = item.mitigation;
  if (item.action)              p.action                   = item.action;
  if (item.deadline)            p.deadline                 = item.deadline;
  if (item.linkedItems?.length) p['linked-items']          = item.linkedItems;
  if (item.tags?.length)        p.tags                     = item.tags;
  if (item.dependencyDirection) p['dependency-direction']  = item.dependencyDirection;
  if (item.dependencyContact)   p['dependency-contact']    = item.dependencyContact;
  // Assumption fields
  if (item.reasoning)           p.reasoning                = item.reasoning;
  if (item.ifWrong)             p['if-wrong']              = item.ifWrong;
  if (item.source)              p.source                   = item.source;
  if (item.recorded)            p.recorded                 = item.recorded;
  if (item.assumptionRisk)      p['assumption-risk']       = item.assumptionRisk;
  // Issue fields
  if (item.issueImpact)         p['issue-impact']          = item.issueImpact;
  if (item.solution)            p.solution                 = item.solution;
  // Dependency fields
  if (item.delayRisk)           p['delay-risk']            = item.delayRisk;

  p['created-at'] = item.createdAt;
  p['updated-at'] = item.updatedAt;
  if (item.history?.length)     p.history                  = item.history;

  return stringifyYaml(p);
}

// ─── Build a new ## section string ────────────────────────────────────────────

export function buildItemSection(item: RaidItem): string {
  return `\n## ${item.id} ${item.title}\n\`\`\`raid\n${serializeItemProps(item)}\`\`\`\n`;
}

// ─── Content-level CRUD helpers ───────────────────────────────────────────────

function splitSections(content: string): string[] {
  // sections[0] = preamble; sections[1..n] each start with "## "
  return content.split(/\n(?=## )/);
}

function joinSections(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return parts[0] + '\n' + parts.slice(1).join('\n');
}

function idPattern(id: string): RegExp {
  return new RegExp(`^## ${id.replace(/-/g, '\\-')} `);
}

export function addItemToContent(content: string, item: RaidItem): string {
  return content.trimEnd() + buildItemSection(item) + '\n';
}

export function updateItemInContent(content: string, item: RaidItem): string {
  const parts = splitSections(content);
  const pat   = idPattern(item.id);
  const idx   = parts.findIndex(p => pat.test(p));

  if (idx === -1) return addItemToContent(content, item);

  const section    = parts[idx];
  const lineEnd    = section.indexOf('\n');
  const newHeading = `## ${item.id} ${item.title}`;
  const body       = lineEnd >= 0 ? section.slice(lineEnd) : '';

  const newBody = body.replace(
    /```raid\n[\s\S]*?```/,
    `\`\`\`raid\n${serializeItemProps(item)}\`\`\``,
  );

  parts[idx] = newHeading + newBody;
  return joinSections(parts);
}

export function deleteItemFromContent(content: string, id: string): string {
  const parts   = splitSections(content);
  const pat     = idPattern(id);
  const filtered = parts.filter(p => !pat.test(p));
  return joinSections(filtered);
}

// ─── Slug helper (for project filenames) ──────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/, '')
    .slice(0, 60);
}
