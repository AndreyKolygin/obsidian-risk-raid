import type { Severity, RaidType } from '../types';

export function severityToClass(severity: Severity): string {
  return `raid-badge--${severity}`;
}

export function typeToClass(type: RaidType): string {
  return `raid-item-card--${type}`;
}
