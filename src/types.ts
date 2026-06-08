export type RaidType = 'risk' | 'assumption' | 'issue' | 'dependency';

export interface HistoryEntry {
  date:    string;   // ISO datetime
  changes: string[]; // human-readable change descriptions
}

export type Probability = 'high' | 'medium' | 'low';
export type Impact = 'high' | 'medium' | 'low';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type RiskStatus = 'open' | 'watch' | 'mitigated' | 'closed';
export type AssumptionStatus = 'confirmed' | 'unconfirmed';
export type IssueStatus = 'blocker' | 'open' | 'in-progress' | 'resolved';
export type DependencyStatus = 'pending' | 'in-progress' | 'confirmed' | 'blocked';

export type RaidStatus =
  | RiskStatus
  | AssumptionStatus
  | IssueStatus
  | DependencyStatus;

export type DependencyDirection = 'inbound' | 'outbound' | 'external';

export interface RaidItem {
  id: string;
  type: RaidType;
  title: string;
  probability?: Probability;
  probabilityNote?: string;
  impact?: Impact;
  impactNote?: string;
  severity?: Severity;
  status: RaidStatus;
  owner: string;
  description: string;
  mitigation?: string;
  action?: string;
  deadline?: string;
  linkedItems?: string[];
  tags?: string[];
  dependencyDirection?: DependencyDirection;
  dependencyContact?: string;
  // Assumption fields
  reasoning?: string;
  ifWrong?: string;
  source?: string;
  recorded?: string;
  assumptionRisk?: string;
  // Issue fields
  issueImpact?: string;
  solution?: string;
  // Dependency fields
  delayRisk?: string;
  // Audit
  history?: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
  filePath: string;
}

export interface RaidProject {
  name: string;
  filePath: string;
}

export interface RaidPluginSettings {
  raidFolder: string;
  defaultView: 'board' | 'matrix';
  autoOpenOnStartup: boolean;
  dateFormat: string;
  showSeverityColors: boolean;
  customOwners: string[];
  customTags: string[];
}
