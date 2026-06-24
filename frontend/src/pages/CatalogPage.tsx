import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Grid, Paper, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SectionHeader from '../components/dashboard/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import { DashboardStats, getApiErrorMessage, getDashboardStats } from '../api/specItemsApi';
import { stepTokens } from '../theme/tokens';
import { PRODUCTIVE_DASHBOARD_NOTE } from '../utils/productiveDashboard';

export default function CatalogPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats({ include_external_items: 'false' });
      setStats(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box>
      <Box sx={{ mb: 3, p: 3, borderRadius: 3, color: '#fff', background: stepTokens.gradient }}>
        <Typography variant="h4" sx={{ color: '#fff', mb: 1 }}>
          Catálogo
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', maxWidth: 760 }}>
          Itens únicos cadastrados no catálogo deduplicado, derivados das ocorrências em specs.
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)', mt: 1 }}>
          {PRODUCTIVE_DASHBOARD_NOTE}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading || !stats ? (
        <TableSkeleton columns={2} rows={3} />
      ) : (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Itens únicos
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {stats.unique_catalog_items?.toLocaleString('pt-BR') ?? '—'}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Ocorrências em specs
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {stats.total_occurrences.toLocaleString('pt-BR')}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Taxa de deduplicação
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {stats.deduplication_percent.toFixed(1)}%
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      <SectionHeader
        title="Explorar ocorrências"
        subtitle="A listagem completa permite filtrar por item_key e abrir o detalhe de cada ocorrência."
        action={(
          <Button variant="contained" endIcon={<OpenInNewIcon />} onClick={() => navigate('/spec-items')}>
            Abrir listagem de itens
          </Button>
        )}
      />

      {!loading && stats && stats.unique_catalog_items === null && (
        <EmptyState
          title="Catálogo normalizado indisponível"
          description="Use a listagem de itens para consultar ocorrências individuais."
        />
      )}
    </Box>
  );
}
