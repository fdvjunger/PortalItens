import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Drawer,
  Grid,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import CategoryIcon from '@mui/icons-material/Category';
import LayersIcon from '@mui/icons-material/Layers';
import PeopleIcon from '@mui/icons-material/People';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ActiveFilterChips from '../components/dashboard/ActiveFilterChips';
import ClientsTable from '../components/dashboard/ClientsTable';
import DashboardCharts from '../components/dashboard/DashboardCharts';
import DashboardFilterAccordion, { emptySpecItemsFilters } from '../components/dashboard/DashboardFilterAccordion';
import KpiCard from '../components/dashboard/KpiCard';
import SectionHeader from '../components/dashboard/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import DataTable from '../components/DataTable';
import {
  DashboardStats,
  SpecItem,
  getApiErrorMessage,
  getDashboardStats,
  getSpecItems,
} from '../api/specItemsApi';
import { SpecItemsFilterValues, filtersToQuery } from '../types/filters';
import { stepTokens } from '../theme/tokens';
import { PRODUCTIVE_DASHBOARD_NOTE } from '../utils/productiveDashboard';

const DRILLDOWN_COLUMNS = [
  'id',
  'cliente',
  'spec_id',
  'item_type',
  'short_code',
  'schedule',
  'material_description',
  'mds',
  'rating',
  'weight',
  'alterDataID',
  'area_m2_per_m',
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [draftFilters, setDraftFilters] = useState<SpecItemsFilterValues>(emptySpecItemsFilters);
  const [appliedFilters, setAppliedFilters] = useState<SpecItemsFilterValues>(emptySpecItemsFilters);
  const [draftIncludeExternal, setDraftIncludeExternal] = useState(false);
  const [includeExternalItems, setIncludeExternalItems] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SpecItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [detailItem, setDetailItem] = useState<SpecItem | null>(null);

  const queryParams = useMemo(
    () => ({
      ...filtersToQuery(appliedFilters),
      include_external_items: includeExternalItems ? 'true' : 'false',
    }),
    [appliedFilters, includeExternalItems],
  );

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats(queryParams);
      setStats(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  const loadTable = useCallback(async () => {
    setTableLoading(true);
    try {
      const response = await getSpecItems({
        page: page + 1,
        page_size: pageSize,
        sort_by: sortBy,
        sort_dir: sortDir,
        ...queryParams,
      });
      setRows(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setTableLoading(false);
    }
  }, [page, pageSize, queryParams, sortBy, sortDir]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const handleFilterChange = (field: keyof SpecItemsFilterValues, value: string) => {
    setDraftFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
    setIncludeExternalItems(draftIncludeExternal);
    setPage(0);
  };

  const handleClearFilters = () => {
    setDraftFilters(emptySpecItemsFilters);
    setAppliedFilters(emptySpecItemsFilters);
    setDraftIncludeExternal(false);
    setIncludeExternalItems(false);
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

  return (
    <Box>
      <Box
        sx={{
          mb: 3,
          p: 3,
          borderRadius: 3,
          color: '#fff',
          background: stepTokens.gradient,
        }}
      >
        <Typography variant="h4" sx={{ color: '#fff', mb: 1 }}>
          Dashboard Spec Portal
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', maxWidth: 760 }}>
          Visão executiva e operacional das ocorrências em spec e da qualidade cadastral.
          Use os filtros para analisar clientes, famílias e completude dos dados.
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)', mt: 1, maxWidth: 820 }}>
          {PRODUCTIVE_DASHBOARD_NOTE}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
          <Chip size="small" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} label="Ocorrências = linhas em spec" />
          <Chip size="small" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} label="Itens únicos = catálogo deduplicado" />
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading || !stats ? (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Grid item xs={12} sm={6} md={3} key={`kpi-skel-${index}`}>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
                <TableSkeleton columns={1} rows={2} />
              </Box>
            </Grid>
          ))}
        </Grid>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              mb: 3,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                lg: 'repeat(4, 1fr)',
              },
            }}
          >
            <KpiCard
              title="Clientes"
              value={stats.unique_clients}
              icon={<PeopleIcon />}
              subtitle="Clientes distintos"
              to="/clientes"
            />
            <KpiCard
              title="Specs"
              value={stats.unique_specs}
              icon={<BusinessIcon />}
              subtitle="Specs distintas"
              accent="secondary"
              to="/specs"
            />
            <KpiCard
              title="Ocorrências"
              value={stats.total_occurrences}
              icon={<LayersIcon />}
              subtitle="Linhas em spec"
              to="/spec-items"
            />
            <KpiCard
              title="Itens únicos"
              value={stats.unique_catalog_items ?? '—'}
              icon={<CategoryIcon />}
              subtitle="Catálogo deduplicado"
              accent="secondary"
              to="/catalog-items"
            />
          </Box>

          <Box sx={{ mb: 3 }}>
            <SectionHeader title="Gráficos principais" subtitle="Distribuições e rankings do escopo produtivo STEP." />
            <DashboardCharts stats={stats} />
          </Box>
        </>
      )}

      <Box sx={{ mb: 2 }}>
        <DashboardFilterAccordion
          values={draftFilters}
          onChange={handleFilterChange}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          includeExternalItems={draftIncludeExternal}
          onIncludeExternalItemsChange={setDraftIncludeExternal}
        />
      </Box>

      <ActiveFilterChips
        values={appliedFilters}
        onRemove={(field) => {
          const next = { ...appliedFilters, [field]: '' };
          setAppliedFilters(next);
          setDraftFilters(next);
          setPage(0);
        }}
      />

      {stats && (
        <>
          <Box sx={{ mb: 3, mt: 3 }}>
            <SectionHeader
              title="Visão por cliente"
              subtitle="Ranking operacional por volume e qualidade."
              action={(
                <Button variant="outlined" onClick={() => navigate('/clientes')}>
                  Ver todos os clientes
                </Button>
              )}
            />
            {stats.clients_summary.length ? (
              <ClientsTable rows={stats.clients_summary} />
            ) : (
              <EmptyState title="Nenhum cliente encontrado" />
            )}
          </Box>
        </>
      )}

      <Box sx={{ mt: 4 }}>
        <SectionHeader
          title="Detalhamento de ocorrências"
          subtitle="Tabela integrada aos filtros do dashboard."
          action={(
            <Button variant="outlined" endIcon={<OpenInNewIcon />} onClick={() => navigate('/spec-items')}>
              Abrir listagem completa
            </Button>
          )}
        />

        {tableLoading ? (
          <TableSkeleton columns={8} rows={10} />
        ) : rows.length ? (
          <DataTable
            columns={DRILLDOWN_COLUMNS}
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
            onView={(id) => {
              const item = rows.find((row) => row.id === id) ?? null;
              if (item) setDetailItem(item);
            }}
          />
        ) : (
          <EmptyState title="Nenhuma ocorrência encontrada" description="Tente limpar ou ajustar os filtros." />
        )}
      </Box>

      <Drawer anchor="right" open={Boolean(detailItem)} onClose={() => setDetailItem(null)}>
        <Box sx={{ width: { xs: '100vw', sm: 420 }, p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Detalhe da ocorrência</Typography>
            <IconButton onClick={() => setDetailItem(null)} aria-label="Fechar">
              <CloseIcon />
            </IconButton>
          </Box>
          {detailItem && (
            <Stack spacing={1.2}>
              <Chip size="small" color="primary" label={`Ocorrência #${detailItem.id}`} />
              {DRILLDOWN_COLUMNS.filter((col) => col !== 'id').map((col) => (
                <Box key={col}>
                  <Typography variant="caption" color="text.secondary">{col}</Typography>
                  <Typography variant="body2">{String(detailItem[col] ?? '—')}</Typography>
                </Box>
              ))}
              <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate(`/spec-items/${detailItem.id}`)}>
                Abrir página completa
              </Button>
            </Stack>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
