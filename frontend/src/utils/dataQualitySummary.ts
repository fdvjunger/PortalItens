import { DashboardStats } from '../api/specItemsApi';

export interface DataQualitySummary {
  totalItems: number;
  pctWithoutWeight: number;
  pctWithoutPaintArea: number;
  pctWithoutMaterial: number;
  pctWithoutAlterdata: number;
}

export function buildDataQualitySummary(
  totalItems: number,
  distribution: DashboardStats['distribution'],
): DataQualitySummary {
  const pct = (count: number) => (totalItems > 0 ? Math.round((count / totalItems) * 1000) / 10 : 0);

  return {
    totalItems,
    pctWithoutWeight: pct(distribution.without_weight),
    pctWithoutPaintArea: pct(distribution.without_paint_area),
    pctWithoutMaterial: pct(distribution.without_material),
    pctWithoutAlterdata: pct(distribution.without_alterdata_id),
  };
}
