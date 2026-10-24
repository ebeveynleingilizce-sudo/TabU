export function assignedPreviewTabs(assignedTabIds, tabs) {
  const assigned = new Set(Array.isArray(assignedTabIds) ? assignedTabIds : []);
  return tabs.filter(tab => assigned.has(tab.id));
}

