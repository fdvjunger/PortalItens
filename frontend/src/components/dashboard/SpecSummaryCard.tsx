import { Box, Card, CardActionArea, CardContent, Grid, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { SpecSummaryRow } from '../../api/specItemsApi';
import PercentIndicator from './PercentIndicator';
import { stepTokens } from '../../theme/tokens';

interface SpecSummaryCardProps {
  row: SpecSummaryRow;
  onClick: () => void;
}

export default function SpecSummaryCard({ row, onClick }: SpecSummaryCardProps) {
  return (
    <Card
      sx={{
        height: '100%',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: '100%', cursor: 'pointer' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: stepTokens.neutral900 }}>
                Spec {row.spec_id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {row.cliente || '—'}
                {row.revision ? ` · Rev. ${row.revision}` : ''}
              </Typography>
            </Box>
            <ArrowForwardIcon sx={{ fontSize: 18, color: stepTokens.secondary }} />
          </Box>

          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Ocorrências
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {row.total_occurrences.toLocaleString('pt-BR')}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Itens produtivos
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {row.total_items_estimate.toLocaleString('pt-BR')}
              </Typography>
            </Grid>
          </Grid>

          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                % sem peso
              </Typography>
              <PercentIndicator value={row.pct_without_weight} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                % sem AlterDataID
              </Typography>
              <PercentIndicator value={row.pct_without_alterdata} />
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
