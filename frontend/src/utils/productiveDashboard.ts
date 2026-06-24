/** Itens excluídos dos indicadores produtivos do dashboard (comprados/externos). */

export const EXCLUDED_ITEM_TYPE_MARKERS = [
  'BOLT',
  'SCREW',
  'STUD',
  'NUT',
  'WASHER',
  'FASTENER',
  'GASKET',
  'VALVE',
] as const;

export const PRODUCTIVE_DASHBOARD_NOTE =
  'Indicadores produtivos desconsideram válvulas, gaskets e fixadores, por serem itens comprados/externos.';

export function isProductiveDashboardItem(itemType: string | null | undefined): boolean {
  if (!itemType) return true;
  const normalized = itemType.trim().toUpperCase();
  if (!normalized) return true;
  return !EXCLUDED_ITEM_TYPE_MARKERS.some((marker) => normalized.includes(marker));
}
