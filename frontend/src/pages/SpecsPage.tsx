import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Grid, Typography } from '@mui/material';
import SpecSummaryCard from '../components/dashboard/SpecSummaryCard';
import SectionHeader from '../components/dashboard/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import { SpecSummaryRow, getApiErrorMessage, getSpecsPage } from '../api/specItemsApi';
import { specPath } from '../utils/navigation';
import { stepTokens } from '../theme/tokens';
import { PRODUCTIVE_DASHBOARD_NOTE } from '../utils/productiveDashboard';

export default function SpecsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SpecSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSpecsPage({ include_external_items: 'false' });
      setRows(data.items);
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
          Specs
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', maxWidth: 720 }}>
          Lista de specs com volume de ocorrências e indicadores resumidos de qualidade cadastral.
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)', mt: 1 }}>
          {PRODUCTIVE_DASHBOARD_NOTE}
        </Typography>
      </Box>

      <SectionHeader title="Todas as specs" subtitle="Clique em uma spec para ver itens e indicadores." />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <TableSkeleton columns={3} rows={6} />
      ) : rows.length ? (
        <Grid container spacing={2}>
          {rows.map((row) => (
            <Grid item xs={12} sm={6} lg={4} key={row.spec_id}>
              <SpecSummaryCard row={row} onClick={() => navigate(specPath(row.spec_id))} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <EmptyState title="Nenhuma spec encontrada" />
      )}
    </Box>
  );
}
