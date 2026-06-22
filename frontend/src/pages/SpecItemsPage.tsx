import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DescriptionIcon from '@mui/icons-material/Description';
import ColumnSelector from '../components/ColumnSelector';
import DataTable from '../components/DataTable';
import FilterBar, { FilterValues } from '../components/FilterBar';
import {
  ColumnMetadata,
  SpecItem,
  downloadBlob,
  exportExcel,
  exportTemplate,
  getApiErrorMessage,
  getColumns,
  getSpecItems,
} from '../api/specItemsApi';

const DEFAULT_VISIBLE_COLUMNS = [
  'id',
  'cliente',
  'item_type',
  'short_code',
  'schedule',
  'material_description',
  'mds',
  'spec_id',
  'has_nace',
  'alterDataID',
];

const initialFilters: FilterValues = {
  global_search: '',
  cliente: '',
  item_type: '',
  short_code: '',
  schedule: '',
  material_description: '',
  mds: '',
  spec_id: '',
  has_nace: '',
};

export default function SpecItemsPage() {
  const navigate = useNavigate();
  const [columns, setColumns] = useState<ColumnMetadata[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
  const [filters, setFilters] = useState<FilterValues>(initialFilters);
  const [rows, setRows] = useState<SpecItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingTemplate, setExportingTemplate] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    getColumns()
      .then((data) => {
        setColumns(data);
        const available = data.map((c) => c.column_name);
        setVisibleColumns(
          DEFAULT_VISIBLE_COLUMNS.filter((col) => available.includes(col)),
        );
      })
      .catch(() => setError('Não foi possível carregar colunas.'));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getSpecItems({
        page: page + 1,
        page_size: pageSize,
        global_search: filters.global_search || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
        cliente: filters.cliente || undefined,
        item_type: filters.item_type || undefined,
        short_code: filters.short_code || undefined,
        schedule: filters.schedule || undefined,
        material_description: filters.material_description || undefined,
        mds: filters.mds || undefined,
        spec_id: filters.spec_id || undefined,
        has_nace: filters.has_nace || undefined,
      });
      setRows(response.items);
      setTotal(response.total);
    } catch {
      setError('Não foi possível carregar itens.');
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize, sortBy, sortDir]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFilterChange = (field: keyof FilterValues, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const handleSortChange = (column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const buildActiveFilters = () => {
    const active: Record<string, string> = {};
    (Object.keys(filters) as Array<keyof FilterValues>).forEach((key) => {
      if (key !== 'global_search' && filters[key]) {
        active[key] = filters[key];
      }
    });
    return active;
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const blob = await exportExcel({
        global_search: filters.global_search,
        filters: buildActiveFilters(),
        sort_by: sortBy,
        sort_dir: sortDir,
        columns: visibleColumns,
      });
      downloadBlob(blob, 'spec_items_export.xlsx');
      setSnackbar({
        open: true,
        message: 'Exportação Excel concluída com sucesso.',
        severity: 'success',
      });
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setError(`Falha ao exportar Excel: ${msg}`);
      console.error('[EXPORT] failed', err);
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handleExportTemplate = async () => {
    setExportingTemplate(true);
    try {
      const blob = await exportTemplate();
      downloadBlob(blob, 'spec_items_template.xlsx');
      setSnackbar({
        open: true,
        message: 'Template Excel baixado com sucesso.',
        severity: 'success',
      });
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setError(`Falha ao exportar template: ${msg}`);
      console.error('[EXPORT TEMPLATE] failed', err);
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setExportingTemplate(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Itens</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={exportingTemplate ? <CircularProgress size={18} /> : <DescriptionIcon />}
            onClick={handleExportTemplate}
            disabled={exportingTemplate}
          >
            Template
          </Button>
          <Button
            variant="outlined"
            startIcon={exporting ? <CircularProgress size={18} /> : <FileDownloadIcon />}
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exportando...' : 'Exportar Excel'}
          </Button>
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            onClick={() => navigate('/import-excel')}
          >
            Importar Excel
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box mb={2}>
        <FilterBar values={filters} onChange={handleFilterChange} />
      </Box>

      <Box mb={2}>
        <ColumnSelector
          columns={columns}
          selected={visibleColumns}
          onChange={setVisibleColumns}
        />
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <DataTable
          columns={visibleColumns}
          rows={rows}
          total={total}
          page={page}
          pageSize={pageSize}
          sortBy={sortBy}
          sortDir={sortDir}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
          onSortChange={handleSortChange}
          onView={(id) => navigate(`/spec-items/${id}`)}
        />
      )}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
