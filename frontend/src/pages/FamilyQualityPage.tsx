import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Chip, Typography } from '@mui/material';
import ActiveFilterChips from '../components/dashboard/ActiveFilterChips';
import DashboardFilterAccordion, { emptySpecItemsFilters } from '../components/dashboard/DashboardFilterAccordion';
import DataQualityTable from '../components/dashboard/DataQualityTable';
import SectionHeader from '../components/dashboard/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import { DashboardStats, getApiErrorMessage, getDashboardStats } from '../api/specItemsApi';
import { SpecItemsFilterValues, filtersToQuery } from '../types/filters';
import { stepTokens } from '../theme/tokens';
import { PRODUCTIVE_DASHBOARD_NOTE } from '../utils/productiveDashboard';
import { buildDataQualitySummary } from '../utils/dataQualitySummary';

export default function FamilyQualityPage() {
  const [draftFilters, setDraftFilters] = useState<SpecItemsFilterValues>(emptySpecItemsFilters);
  const [appliedFilters, setAppliedFilters] = useState<SpecItemsFilterValues>(emptySpecItemsFilters);
  const [draftIncludeExternal, setDraftIncludeExternal] = useState(false);
  const [includeExternalItems, setIncludeExternalItems] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleFilterChange = (field: keyof SpecItemsFilterValues, value: string) => {
    setDraftFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
    setIncludeExternalItems(draftIncludeExternal);
  };

  const handleClearFilters = () => {
    setDraftFilters(emptySpecItemsFilters);
    setAppliedFilters(emptySpecItemsFilters);
    setDraftIncludeExternal(false);
    setIncludeExternalItems(false);
  };

  return (
    <Box>
      <Box
        sx={{
          mb: 3,
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          color: '#fff',
          background: stepTokens.gradient,
        }}
      >
        <Typography variant="h4" sx={{ color: '#fff', mb: 1, fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
          Qualidade cadastral por família
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', maxWidth: 760 }}>
          Percentuais de lacunas por item_type. Ordene as colunas para priorizar famílias com maior impacto.
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)', mt: 1, maxWidth: 820 }}>
          {PRODUCTIVE_DASHBOARD_NOTE}
        </Typography>
      </Box>

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
        }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <SectionHeader
        title="Famílias / item types"
        subtitle="Clique nos cabeçalhos para ordenar. Role horizontalmente em telas menores."
        badge={
          stats ? (
            <Chip size="small" label={`${stats.quality_by_family.length} famílias`} color="primary" variant="outlined" />
          ) : undefined
        }
      />

      {loading ? (
        <TableSkeleton columns={6} rows={12} />
      ) : stats?.quality_by_family.length ? (
        <DataQualityTable
          rows={stats.quality_by_family}
          summary={buildDataQualitySummary(stats.total_occurrences, stats.distribution)}
          maxHeight="none"
        />
      ) : (
        <EmptyState
          title="Sem dados para qualidade por família"
          description="Ajuste os filtros ou aguarde a carga dos dados."
        />
      )}
    </Box>
  );
}
