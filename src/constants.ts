import type { RaidType, Probability, Impact, Severity, RaidPluginSettings } from './types';

export const SEVERITY_MATRIX: Record<Probability, Record<Impact, Severity>> = {
  high:   { low: 'medium', medium: 'high',   high: 'critical' },
  medium: { low: 'low',    medium: 'medium',  high: 'high'     },
  low:    { low: 'low',    medium: 'low',     high: 'medium'   },
};

export const TYPE_PREFIXES: Record<RaidType, string> = {
  risk:        'R',
  assumption:  'A',
  issue:       'I',
  dependency:  'D',
};

export const STATUS_LABELS: Record<string, string> = {
  open:          'Open',
  watch:         'Watch',
  mitigated:     'Mitigated',
  closed:        'Closed',
  confirmed:     'Confirmed',
  unconfirmed:   'Unconfirmed',
  blocker:       'Blocker',
  'in-progress': 'In Progress',
  resolved:      'Resolved',
  pending:       'Pending',
  blocked:       'Blocked',
};

export const TYPE_STATUSES: Record<RaidType, string[]> = {
  risk:        ['open', 'watch', 'mitigated', 'closed'],
  assumption:  ['confirmed', 'unconfirmed'],
  issue:       ['blocker', 'open', 'in-progress', 'resolved'],
  dependency:  ['pending', 'in-progress', 'confirmed', 'blocked'],
};

export const DEFAULT_SETTINGS: RaidPluginSettings = {
  raidFolder:        'RAID',
  defaultView:       'board',
  autoOpenOnStartup: false,
  dateFormat:        'YYYY-MM-DD',
  showSeverityColors: true,
  customOwners:      [],
  customTags:        [],
};

export const RAID_BOARD_VIEW_TYPE   = 'raid-board-view';
export const RISK_MATRIX_VIEW_TYPE  = 'risk-matrix-view';
