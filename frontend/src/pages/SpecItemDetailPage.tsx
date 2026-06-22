import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { getSpecItem, SpecItem } from '../api/specItemsApi';

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

export default function SpecItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<SpecItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getSpecItem(Number(id))
      .then(setItem)
      .catch(() => setError('Item não encontrado.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !item) {
    return <Alert severity="error">{error}</Alert>;
  }

  const fields = Object.keys(item).sort((a, b) => a.localeCompare(b));

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/spec-items')}
        sx={{ mb: 2 }}
      >
        Voltar
      </Button>

      <Typography variant="h4" gutterBottom>
        Item #{item.id}
      </Typography>

      <Card>
        <CardContent>
          <Grid container spacing={2}>
            {fields.map((field) => (
              <Grid item xs={12} sm={6} md={4} key={field}>
                <Typography variant="caption" color="text.secondary">
                  {field}
                </Typography>
                <Typography variant="body1">{formatValue(item[field])}</Typography>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
