import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Grid, Typography } from '@mui/material';
import ClientSummaryCard from '../components/dashboard/ClientSummaryCard';
import SectionHeader from '../components/dashboard/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import { ClientSummaryRow, getApiErrorMessage, getClientsPage } from '../api/specItemsApi';
import { clientePath } from '../utils/navigation';
import { stepTokens } from '../theme/tokens';
import { PRODUCTIVE_DASHBOARD_NOTE } from '../utils/productiveDashboard';

export default function ClientsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ClientSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClientsPage({ include_external_items: 'false' });
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
          Clientes
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', maxWidth: 720 }}>
          Resumo por cliente com volume em specs e indicadores de qualidade cadastral.
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)', mt: 1 }}>
          {PRODUCTIVE_DASHBOARD_NOTE}
        </Typography>
      </Box>

      <SectionHeader title="Todos os clientes" subtitle="Clique em um card para ver specs e itens cadastrados." />

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
            <Grid item xs={12} sm={6} lg={4} key={row.cliente}>
              <ClientSummaryCard row={row} onClick={() => navigate(clientePath(row.cliente))} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <EmptyState title="Nenhum cliente encontrado" />
      )}
    </Box>
  );
}
