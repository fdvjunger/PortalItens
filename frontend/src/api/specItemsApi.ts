import http from './http';

export interface ColumnMetadata {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  ordinal_position: number;
}

export interface SpecItem {
  id: number;
  cliente?: string | null;
  spec_id?: number | null;
  source_page?: number | null;
  item_type?: string | null;
  short_code?: string | null;
  nps?: number | null;
  schedule?: string | null;
  geometric_standard?: string | null;
  eds_vds?: string | null;
  end_conn_1?: string | null;
  end_conn_2?: string | null;
  material_description?: string | null;
  mds?: string | null;
  rating?: string | null;
  notes?: string | null;
  nps_polegadas?: string | null;
  item_key?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  weight?: number | null;
  weight_unit?: string | null;
  dn_mm?: number | null;
  od_mm?: number | null;
  wall_thk_mm?: number | null;
  id_mm?: number | null;
  nps_table_col_index?: number | null;
  nps_raw?: string | null;
  nps_row_raw_cells_json?: string | null;
  nps_table?: string | null;
  half_od_mm?: number | null;
  weight_basis?: string | null;
  weight_source_file?: string | null;
  weight_source_sheet?: string | null;
  weight_source_row?: number | null;
  weight_match_method?: string | null;
  weight_match_confidence?: number | null;
  alterDataID?: string | null;
  has_nace?: boolean | null;
  dm_ex?: number | null;
  area_m2_per_m?: number | null;
  sch_mm?: number | null;
  radius?: number | null;
  [key: string]: unknown;
}

export interface SpecItemsListResponse {
  page: number;
  page_size: number;
  total: number;
  items: SpecItem[];
}

export interface SpecItemsQuery {
  page?: number;
  page_size?: number;
  global_search?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  cliente?: string;
  item_type?: string;
  short_code?: string;
  schedule?: string;
  material_description?: string;
  mds?: string;
  spec_id?: string | number;
  has_nace?: string;
  rating?: string;
  has_weight?: string;
  has_alterdata?: string;
  has_paint_area?: string;
  has_material?: string;
  include_external_items?: string;
}

export interface FamilyQualityRow {
  item_type: string;
  total: number;
  without_weight: number;
  without_alterdata: number;
  without_paint_area: number;
  without_material: number;
  pct_without_weight: number;
  pct_without_alterdata: number;
  pct_without_paint_area: number;
  pct_without_material: number;
}

export interface ClientSummaryRow {
  cliente: string;
  total_occurrences: number;
  total_specs: number;
  total_items_estimate: number;
  without_weight: number;
  without_alterdata: number;
  without_paint_area: number;
  without_material: number;
  pct_without_weight: number;
  pct_without_alterdata: number;
  pct_without_paint_area: number;
  pct_without_material: number;
}

export interface SpecSummaryRow {
  spec_id: number;
  cliente: string | null;
  revision: string | null;
  total_occurrences: number;
  total_items_estimate: number;
  pct_without_weight: number;
  pct_without_alterdata: number;
  pct_without_paint_area: number;
  pct_without_material: number;
}

export interface ClientDetail {
  cliente: string;
  summary: ClientSummaryRow;
  total_occurrences: number;
  total_specs: number;
  unique_catalog_items: number | null;
  distribution: DashboardStats['distribution'];
  quality_by_family: FamilyQualityRow[];
  specs: Array<SpecSummaryRow & { without_weight?: number; without_alterdata?: number }>;
  productive_scope?: DashboardStats['productive_scope'];
}

export interface SpecDetail {
  spec_id: number;
  cliente: string | null;
  revision: string | null;
  total_occurrences: number;
  unique_catalog_items: number | null;
  distribution: DashboardStats['distribution'];
  quality_by_family: FamilyQualityRow[];
  summary: {
    total_occurrences: number;
    pct_without_weight: number;
    pct_without_alterdata: number;
    pct_without_paint_area: number;
    pct_without_material: number;
  };
  productive_scope?: DashboardStats['productive_scope'];
}

export interface DashboardStats {
  total_items: number;
  total_occurrences: number;
  unique_clients: number;
  unique_specs: number;
  unique_catalog_items: number | null;
  deduplication_percent: number;
  by_client: Array<{ cliente: string; total: number }>;
  clients_summary: ClientSummaryRow[];
  quality_by_family: FamilyQualityRow[];
  top_schedules: Array<{ label: string; total: number }>;
  top_materials: Array<{ label: string; total: number }>;
  distribution: {
    with_weight: number;
    without_weight: number;
    with_alterdata_id: number;
    without_alterdata_id: number;
    with_paint_area: number;
    without_paint_area: number;
    with_material: number;
    without_material: number;
  };
  total_pipe: number;
  total_flange: number;
  with_alterdata_id: number;
  without_alterdata_id: number;
  productive_scope?: {
    include_external_items: boolean;
    note: string;
    excluded_markers: string[];
  };
}

export type DashboardStatsQuery = Omit<SpecItemsQuery, 'page' | 'page_size' | 'sort_by' | 'sort_dir'> & {
  include_external_items?: string;
};

export interface SuggestedMapping {
  excel_column: string;
  suggested_target_column: string | null;
  confidence: number;
  action: 'MAP_TO_EXISTING' | 'IGNORE';
}

export interface AnalyzeResult {
  ok: boolean;
  run_id: number;
  status: string;
  message: string;
}

export interface ImportRunStatus {
  ok: boolean;
  run_id: number;
  status: string;
  phase: string | null;
  progress_current: number;
  progress_total: number;
  progress_percent: number;
  message: string | null;
  file_name?: string;
  sheet_name?: string | null;
  unknown_columns?: string[];
  summary?: PreviewSummary | null;
  error_message?: string | null;
}

export interface AsyncJobResult {
  ok: boolean;
  run_id: number;
  status: string;
  message?: string;
  already_running?: boolean;
  already_ready?: boolean;
}

export interface PaginatedResult<T> {
  page: number;
  page_size: number;
  total: number;
  items: T[];
}

export interface ColumnMappingRow {
  excel_column_name: string;
  target_column_name: string | null;
  action: 'MAP_TO_EXISTING' | 'IGNORE';
  confidence: number | null;
  sample_values?: string[];
  status?: string;
}

export interface ImportRunInfo {
  id: number;
  file_name: string;
  sheet_name: string | null;
  status: string;
  total_rows: number;
  inserted_rows: number;
  updated_rows: number;
  unchanged_rows: number;
  ignored_rows: number;
  error_rows: number;
  created_at: string;
  applied_at: string | null;
  error_message: string | null;
}

export interface ImportRunDetail {
  ok: boolean;
  run: ImportRunInfo;
  column_mappings: ColumnMappingRow[];
  target_columns: string[];
}

export interface PreviewSummary {
  total_rows: number;
  valid_rows?: number;
  row_error_rows?: number;
  insert_rows: number;
  update_rows: number;
  unchanged_rows: number;
  ignored_rows: number;
  error_rows: number;
  warning_rows?: number;
  coerced_values?: number;
  fatal_errors?: number;
  can_apply_valid_rows?: boolean;
}

export interface CoercedValueSample {
  excel_row_number: number;
  column_name: string;
  raw_value?: string | null;
  parsed_value?: string | null;
  coercion_method?: string | null;
  scale_divisor?: string | null;
  warning_message?: string | null;
}

export interface PreviewDiff {
  excel_row_number: number;
  target_id: number | null;
  column_name: string;
  raw_value?: string | null;
  parsed_value?: string | null;
  old_value: string | null;
  new_value: string | null;
  diff_type: string;
}

export interface NumericParseSample {
  excel_row_number: number | null;
  raw: string | null;
  parsed: string | null;
}

export interface PreviewError {
  excel_row_number: number | null;
  column_name: string | null;
  value: string | null;
  error_message: string;
}

export interface PreviewWarning {
  excel_row_number: number | null;
  column_name: string | null;
  raw_value?: string | null;
  parsed_value?: string | null;
  coercion_method?: string | null;
  scale_divisor?: string | null;
  warning_message: string;
}

export interface PreviewResult {
  ok: boolean;
  run_id: number;
  status?: string;
  message?: string;
  hint?: string;
  corruption?: {
    is_corrupted: boolean;
    reason?: string | null;
    samples?: Array<{
      excel_row_number: number;
      column_name: string;
      raw_value?: string | null;
    }>;
  };
  summary: PreviewSummary;
  columns: {
    mapped_count: number;
    ignored_count: number;
    unknown_count: number;
  };
  numeric_parse_samples?: Record<string, NumericParseSample[]>;
  coerced_value_samples?: CoercedValueSample[];
  warnings?: PreviewWarning[];
  sample_diffs: PreviewDiff[];
  errors: PreviewError[];
}

export interface ApplyResult {
  ok: boolean;
  run_id: number;
  status: string;
  mode?: string;
  message?: string;
  inserted_rows?: number;
  updated_rows?: number;
  unchanged_rows?: number;
  applied_rows?: number;
  skipped_error_rows?: number;
  error_rows?: number;
  fatal_errors?: number;
}

export interface ExportExcelPayload {
  global_search?: string;
  filters?: Record<string, string | number | boolean>;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  columns?: string[];
}

export interface MappingPayload {
  mappings: Array<{
    excel_column_name: string;
    action: 'MAP_TO_EXISTING' | 'IGNORE';
    target_column_name?: string | null;
    confidence?: number | null;
  }>;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as {
      response?: {
        data?: { detail?: string | { message?: string; error?: string } | Array<{ msg: string }> };
        headers?: Record<string, string>;
      };
    }).response;
    const detail = response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      if ('message' in detail && typeof detail.message === 'string') {
        const missing = 'missing_columns' in detail && Array.isArray(detail.missing_columns)
          ? detail.missing_columns as string[]
          : [];
        if (missing.length > 0) {
          return `${detail.message} Colunas ausentes: ${missing.join(', ')}.`;
        }
        return detail.message;
      }
      if ('error' in detail && typeof detail.error === 'string') return detail.error;
    }
    if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ');
  }
  if (error instanceof Error) return error.message;
  return 'Erro desconhecido';
}

export function getApiRequestId(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const headers = (error as { response?: { headers?: Record<string, string> } }).response?.headers;
    return headers?.['x-request-id'] ?? null;
  }
  return null;
}

export async function getHealth() {
  const { data } = await http.get('/health');
  return data;
}

export async function getColumns(): Promise<ColumnMetadata[]> {
  const { data } = await http.get('/spec-items/columns');
  return data;
}

export async function getDashboardStats(params: DashboardStatsQuery = {}): Promise<DashboardStats> {
  const { data } = await http.get('/spec-items/stats', { params });
  return data;
}

export async function getClientsPage(params: DashboardStatsQuery = {}): Promise<{
  items: ClientSummaryRow[];
  total: number;
  productive_scope?: DashboardStats['productive_scope'];
}> {
  const { data } = await http.get('/spec-items/clients', { params });
  return data;
}

export async function getClientDetail(cliente: string, params: DashboardStatsQuery = {}): Promise<ClientDetail> {
  const { data } = await http.get(`/spec-items/clients/${encodeURIComponent(cliente)}`, { params });
  return data;
}

export async function getSpecsPage(params: DashboardStatsQuery = {}): Promise<{
  items: SpecSummaryRow[];
  total: number;
  productive_scope?: DashboardStats['productive_scope'];
}> {
  const { data } = await http.get('/spec-items/specs', { params });
  return data;
}

export async function getSpecDetail(specId: number, params: DashboardStatsQuery = {}): Promise<SpecDetail> {
  const { data } = await http.get(`/spec-items/specs/${specId}`, { params });
  return data;
}

export async function getSpecItems(params: SpecItemsQuery): Promise<SpecItemsListResponse> {
  const { data } = await http.get('/spec-items', { params });
  return data;
}

export async function getSpecItem(id: number): Promise<SpecItem> {
  const { data } = await http.get(`/spec-items/${id}`);
  return data;
}

export async function exportExcel(payload: ExportExcelPayload): Promise<Blob> {
  const { data } = await http.post('/spec-items/export-excel', payload, {
    responseType: 'blob',
  });
  return data;
}

export async function exportTemplate(): Promise<Blob> {
  const { data } = await http.get('/spec-items/export-template', {
    responseType: 'blob',
  });
  return data;
}

export async function analyzeImportExcel(file: File): Promise<AnalyzeResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await http.post('/spec-items/import-excel/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return data;
}

export async function getImportStatus(runId: number, signal?: AbortSignal): Promise<ImportRunStatus> {
  const { data } = await http.get(`/spec-items/import-excel/runs/${runId}/status`, { signal });
  return data;
}

export async function getImportRunDetail(runId: number, signal?: AbortSignal): Promise<ImportRunDetail> {
  const { data } = await http.get(`/spec-items/import-excel/runs/${runId}`, { signal });
  return data;
}

export async function saveImportMapping(runId: number, payload: MappingPayload): Promise<AsyncJobResult> {
  const { data } = await http.post(`/spec-items/import-excel/runs/${runId}/mapping`, payload);
  return data;
}

export async function startImportPreview(runId: number): Promise<AsyncJobResult> {
  const { data } = await http.post(`/spec-items/import-excel/runs/${runId}/preview`);
  return data;
}

export async function getImportPreview(runId: number, signal?: AbortSignal): Promise<PreviewResult> {
  const { data } = await http.get(`/spec-items/import-excel/runs/${runId}/preview`, { signal });
  return data;
}

export async function rebuildImportPreview(runId: number): Promise<AsyncJobResult> {
  const { data } = await http.post(`/spec-items/import-excel/runs/${runId}/rebuild-preview`);
  return data;
}

export async function reanalyzeImport(runId: number): Promise<AsyncJobResult & { message?: string }> {
  const { data } = await http.post(`/spec-items/import-excel/runs/${runId}/reanalyze`);
  return data;
}

export async function applyImport(
  runId: number,
  mode: 'valid_rows_only' | 'all_or_nothing' = 'valid_rows_only',
): Promise<AsyncJobResult> {
  const { data } = await http.post(`/spec-items/import-excel/runs/${runId}/apply`, { mode });
  return data;
}

export async function exportImportErrors(runId: number): Promise<Blob> {
  const { data } = await http.get(`/spec-items/import-excel/runs/${runId}/errors/export`, {
    responseType: 'blob',
  });
  return data;
}

export async function getImportErrors(
  runId: number,
  page = 1,
  pageSize = 100,
): Promise<PaginatedResult<PreviewError>> {
  const { data } = await http.get(`/spec-items/import-excel/runs/${runId}/errors`, {
    params: { page, page_size: pageSize },
  });
  return data;
}

export async function getImportWarnings(
  runId: number,
  page = 1,
  pageSize = 100,
): Promise<PaginatedResult<PreviewWarning>> {
  const { data } = await http.get(`/spec-items/import-excel/runs/${runId}/warnings`, {
    params: { page, page_size: pageSize },
  });
  return data;
}

export async function getImportDiffs(
  runId: number,
  page = 1,
  pageSize = 100,
): Promise<PaginatedResult<PreviewDiff>> {
  const { data } = await http.get(`/spec-items/import-excel/runs/${runId}/diffs`, {
    params: { page, page_size: pageSize },
  });
  return data;
}

export interface RawExcelCellDebug {
  excel_column: string;
  cell_coordinate: string;
  value: unknown;
  value_str: string | null;
  python_type: string | null;
  data_type: string;
  number_format: string;
  serialized_for_staging?: unknown;
}

export interface RawExcelRowDebug {
  excel_row_number: number;
  cells: RawExcelCellDebug[];
}

export interface RawVsStagingSample {
  excel_row_number: number;
  column: string;
  excel_column: string;
  excel_raw_value: string | null;
  excel_python_type: string | null;
  excel_data_type: string | null;
  excel_number_format: string | null;
  staging_raw_value: string | null;
  status: 'OK' | 'MISMATCH' | 'MISSING_IN_STAGING' | 'MISSING_IN_EXCEL' | 'OK_CONTAMINATED_SOURCE';
}

export interface RawVsStagingDiagnostic {
  ok: boolean;
  run_id: number;
  source_file_path: string;
  sheet_name: string | null;
  diagnosis: 'OK' | 'STAGING_BUG' | 'CONTAMINATED_SOURCE' | 'MIXED' | 'NO_SAMPLES';
  message: string;
  samples: RawVsStagingSample[];
}

export async function getImportRawVsStaging(runId: number, maxRows = 20): Promise<RawVsStagingDiagnostic> {
  const { data } = await http.get(`/spec-items/import-excel/runs/${runId}/debug/raw-vs-staging`, {
    params: { max_rows: maxRows },
  });
  return data;
}

export async function getImportRawExcelSample(runId: number, maxRows = 10): Promise<{
  ok: boolean;
  run_id: number;
  source_file_path: string;
  sheet_name: string | null;
  rows: RawExcelRowDebug[];
}> {
  const { data } = await http.get(`/spec-items/import-excel/runs/${runId}/debug/raw-excel-sample`, {
    params: { max_rows: maxRows },
  });
  return data;
}

export async function cancelImport(runId: number): Promise<{ ok: boolean; run_id: number; status: string }> {
  const { data } = await http.post(`/spec-items/import-excel/runs/${runId}/cancel`);
  return data;
}

export function getApiErrorMessage(error: unknown): string {
  return extractErrorMessage(error);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
