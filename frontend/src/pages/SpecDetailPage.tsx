import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Grid,
  Link,
  Paper,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ActiveFilterChips from '../components/dashboard/ActiveFilterChips';
import DashboardFilterAccordion, { emptySpecItemsFilters } from '../components/dashboard/DashboardFilterAccordion';
import DataQualityTable from '../components/dashboard/DataQualityTable';
import PercentIndicator from '../components/dashboard/PercentIndicator';
import SectionHeader from '../components/dashboard/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import DataTable from '../components/DataTable';
import {
  SpecDetail,
  SpecItem,
  getApiErrorMessage,
  getSpecDetail,
  getSpecItems,
} from '../api/specItemsApi';
import { SpecItemsFilterValues, filtersToQuery } from '../types/filters';
import { clientePath } from '../utils/navigation';
import { buildDataQualitySummary } from '../utils/dataQualitySummary';

const ITEM_COLUMNS = [
  'id',
  'cliente',
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

export default function SpecDetailPage() {
  const { id } = useParams();
  const specId = Number(id);
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftFilters, setDraftFilters] = useState<SpecItemsFilterValues>(emptySpecItemsFilters);
  const [appliedFilters, setAppliedFilters] = useState<SpecItemsFilterValues>(emptySpecItemsFilters);
  const [draftIncludeExternal, setDraftIncludeExternal] = useState(false);
  const [includeExternalItems, setIncludeExternalItems] = useState(false);
  const [rows, setRows] = useState<SpecItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const queryParams = useMemo(
    () => ({
      ...filtersToQuery(appliedFilters),
      spec_id: specId,
      include_external_items: includeExternalItems ? 'true' : 'false',
    }),
    [appliedFilters, includeExternalItems, specId],
  );

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(specId)) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getSpecDetail(specId, { include_external_items: 'false' });
      setDetail(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [specId]);

  const loadItems = useCallback(async () => {
    if (!Number.isFinite(specId)) return;
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
    }
  }, [page, pageSize, queryParams, sortBy, sortDir, specId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

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

  if (!Number.isFinite(specId)) {
    return <EmptyState title="Spec inválida" />;
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/dashboard" underline="hover" color="inherit">
          Dashboard
        </Link>
        <Link component={RouterLink} to="/specs" underline="hover" color="inherit">
          Specs
        </Link>
        <Typography color="text.primary">Spec {specId}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Spec {specId}
          </Typography>
          {detail && (
            <Typography variant="body1" color="text.secondary">
              {detail.cliente ? (
                <>
                  Cliente:{' '}
                  <Link
                    component={RouterLink}
                    to={clientePath(detail.cliente)}
                    underline="hover"
                  >
                    {detail.cliente}
                  </Link>
                </>
              ) : (
                'Cliente não informado'
              )}
              {detail.revision ? ` · Revisão ${detail.revision}` : ''}
            </Typography>
          )}
        </Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/specs')}>
          Voltar
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading || !detail ? (
        <TableSkeleton columns={4} rows={4} />
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Ocorrências
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {detail.total_occurrences.toLocaleString('pt-BR')}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Itens únicos
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {detail.unique_catalog_items?.toLocaleString('pt-BR') ?? '—'}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  % sem peso
                </Typography>
                <PercentIndicator value={detail.summary.pct_without_weight} />
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  % sem AlterDataID
                </Typography>
                <PercentIndicator value={detail.summary.pct_without_alterdata} />
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  % sem área de pintura
                </Typography>
                <PercentIndicator value={detail.summary.pct_without_paint_area} />
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  % sem material
                </Typography>
                <PercentIndicator value={detail.summary.pct_without_material} />
              </Paper>
            </Grid>
          </Grid>

          {detail.quality_by_family.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <SectionHeader title="Qualidade por família nesta spec" />
              <DataQualityTable
                rows={detail.quality_by_family}
                summary={buildDataQualitySummary(detail.total_occurrences, detail.distribution)}
                maxHeight={420}
              />
            </Box>
          )}
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

      <Box sx={{ mt: 3 }}>
        <SectionHeader
          title="Itens da spec"
          subtitle="Tabela filtrável das ocorrências desta spec."
          badge={<Chip size="small" label={`Spec ${specId}`} color="primary" variant="outlined" />}
        />
        {rows.length ? (
          <DataTable
            columns={ITEM_COLUMNS}
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
            onView={(itemId) => navigate(`/spec-items/${itemId}`)}
          />
        ) : (
          !loading && <EmptyState title="Nenhum item encontrado" description="Ajuste os filtros ou aguarde a carga." />
        )}
      </Box>
    </Box>
  );
}
