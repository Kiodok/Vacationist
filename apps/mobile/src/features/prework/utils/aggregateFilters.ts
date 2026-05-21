import type { PreworkPreferences } from '@vacationist/types';

export interface FilterBreakdown {
  userId: string;
  weight: number;
}

export interface AggregatedFilter {
  label: string;
  totalCredits: number;
  memberCount: number;
  breakdown: FilterBreakdown[];
}

export function aggregateFilters(
  allPreferences: PreworkPreferences[],
): AggregatedFilter[] {
  const groupMap = new Map<string, { displayLabel: string; labelCounts: Map<string, number>; entries: FilterBreakdown[] }>();

  for (const pref of allPreferences) {
    for (const filter of pref.filters) {
      const key = filter.label.trim().toLowerCase();
      if (!key) continue;

      let group = groupMap.get(key);
      if (!group) {
        group = { displayLabel: filter.label.trim(), labelCounts: new Map(), entries: [] };
        groupMap.set(key, group);
      }

      const exactLabel = filter.label.trim();
      group.labelCounts.set(exactLabel, (group.labelCounts.get(exactLabel) ?? 0) + 1);
      group.entries.push({ userId: pref.user_id, weight: filter.weight });
    }
  }

  const result: AggregatedFilter[] = [];
  for (const group of groupMap.values()) {
    let bestLabel = group.displayLabel;
    let bestCount = 0;
    for (const [label, count] of group.labelCounts) {
      if (count > bestCount) {
        bestCount = count;
        bestLabel = label;
      }
    }

    const totalCredits = group.entries.reduce((sum, e) => sum + e.weight, 0);

    result.push({
      label: bestLabel,
      totalCredits,
      memberCount: group.entries.length,
      breakdown: group.entries,
    });
  }

  result.sort((a, b) => b.totalCredits - a.totalCredits);
  return result;
}

export function getRecommendedLabels(
  allPreferences: PreworkPreferences[],
  currentUserId: string | undefined,
  myFilterLabels: string[],
): string[] {
  const myLabelsNormalized = new Set(myFilterLabels.map((l) => l.trim().toLowerCase()));
  const labelSet = new Map<string, string>();

  for (const pref of allPreferences) {
    if (pref.user_id === currentUserId) continue;
    for (const filter of pref.filters) {
      const key = filter.label.trim().toLowerCase();
      if (!key || myLabelsNormalized.has(key)) continue;
      if (!labelSet.has(key)) {
        labelSet.set(key, filter.label.trim());
      }
    }
  }

  return Array.from(labelSet.values());
}
