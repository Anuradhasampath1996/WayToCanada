export const PIPELINE_STATUS_KEYS = [
  "AGREEMENT_SIGNED",
  "DOCUMENTS_UPLOADING",
  "UNDER_REVIEW",
  "READY_FOR_SUBMISSION",
  "APPLICATION_SUBMITTED",
] as const;

export type PipelineStatusKey = (typeof PIPELINE_STATUS_KEYS)[number];

export type PipelineBoardColumn = {
  id: string;
  statusKey: PipelineStatusKey;
  label: string;
  isCustom: boolean;
};

export type PipelineBoardConfig = {
  order: string[];
  columns: Record<
    string,
    {
      statusKey: PipelineStatusKey;
      label: string;
      isCustom: boolean;
      hidden?: boolean;
    }
  >;
};

const STORAGE_KEY = "wtc_consultant_pipeline_board_v1";

export const DEFAULT_COLUMN_LABELS: Record<PipelineStatusKey, string> = {
  AGREEMENT_SIGNED: "Retainer Signed",
  DOCUMENTS_UPLOADING: "Documents Uploading",
  UNDER_REVIEW: "Under Review",
  READY_FOR_SUBMISSION: "Ready for Submission",
  APPLICATION_SUBMITTED: "Application Submitted",
};

export function defaultBoardConfig(): PipelineBoardConfig {
  const columns: PipelineBoardConfig["columns"] = {};
  for (const statusKey of PIPELINE_STATUS_KEYS) {
    columns[statusKey] = {
      statusKey,
      label: DEFAULT_COLUMN_LABELS[statusKey],
      isCustom: false,
    };
  }
  return {
    order: [...PIPELINE_STATUS_KEYS],
    columns,
  };
}

export function loadBoardConfig(): PipelineBoardConfig {
  if (typeof window === "undefined") return defaultBoardConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultBoardConfig();
    const parsed = JSON.parse(raw) as PipelineBoardConfig;
    if (!parsed.order?.length || !parsed.columns) return defaultBoardConfig();
    return parsed;
  } catch {
    return defaultBoardConfig();
  }
}

export function saveBoardConfig(config: PipelineBoardConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function visibleBoardColumns(config: PipelineBoardConfig): PipelineBoardColumn[] {
  const seen = new Set<PipelineStatusKey>();
  const result: PipelineBoardColumn[] = [];

  for (const id of config.order) {
    const col = config.columns[id];
    if (!col || col.hidden || seen.has(col.statusKey)) continue;
    seen.add(col.statusKey);
    result.push({
      id,
      statusKey: col.statusKey,
      label: col.label,
      isCustom: col.isCustom,
    });
  }

  return result;
}

export function usedStatusKeys(config: PipelineBoardConfig, excludeId?: string): Set<PipelineStatusKey> {
  const used = new Set<PipelineStatusKey>();
  for (const id of config.order) {
    if (id === excludeId) continue;
    const col = config.columns[id];
    if (col && !col.hidden) used.add(col.statusKey);
  }
  return used;
}

export function availableStatusKeys(config: PipelineBoardConfig): PipelineStatusKey[] {
  const used = usedStatusKeys(config);
  return PIPELINE_STATUS_KEYS.filter((k) => !used.has(k));
}

export function addCustomColumn(
  config: PipelineBoardConfig,
  label: string,
  statusKey: PipelineStatusKey,
): PipelineBoardConfig {
  const id = `custom-${crypto.randomUUID().slice(0, 8)}`;
  const columns = { ...config.columns };

  for (const [colId, col] of Object.entries(columns)) {
    if (col.statusKey === statusKey && !col.hidden) {
      columns[colId] = { ...col, hidden: true };
    }
  }

  columns[id] = {
    statusKey,
    label: label.trim() || DEFAULT_COLUMN_LABELS[statusKey],
    isCustom: true,
  };

  return { order: [...config.order, id], columns };
}
