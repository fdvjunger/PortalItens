import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Typography,
} from '@mui/material';
import { getDashboardStats, DashboardStats } from '../api/specItemsApi';

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <Card elevation={1}>
      <CardContent>
        <Typography color="text.secondary" gutterBottom variant="body2">
          {title}
        </Typography>
        <Typography variant="h4">{value}</Typography>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => setError('Não foi possível carregar estatísticas.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !stats) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard title="Total de itens" value={stats.total_items} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard title="Total PIPE" value={stats.total_pipe} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard title="Total FLANGE" value={stats.total_flange} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard title="Com alterDataID" value={stats.with_alterdata_id} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard title="Sem alterDataID" value={stats.without_alterdata_id} />
        </Grid>
      </Grid>

      <Box mt={3}>
        <Typography variant="h6" gutterBottom>
          Total por cliente
        </Typography>
        <Grid container spacing={2}>
          {stats.by_client.map((row) => (
            <Grid item xs={12} sm={6} md={4} key={row.cliente}>
              <StatCard title={row.cliente} value={row.total} />
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}
