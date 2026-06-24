import { Box, Card, CardActionArea, CardContent, Grid, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { ClientSummaryRow } from '../../api/specItemsApi';
import PercentIndicator from './PercentIndicator';
import { stepTokens } from '../../theme/tokens';

interface ClientSummaryCardProps {
  row: ClientSummaryRow;
  onClick: () => void;
}

export default function ClientSummaryCard({ row, onClick }: ClientSummaryCardProps) {
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: stepTokens.neutral900 }}>
              {row.cliente}
            </Typography>
            <ArrowForwardIcon sx={{ fontSize: 18, color: stepTokens.primary, mt: 0.5 }} />
          </Box>

          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">
                Specs
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {row.total_specs.toLocaleString('pt-BR')}
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">
                Ocorrências
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {row.total_occurrences.toLocaleString('pt-BR')}
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">
                Itens produtivos
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {row.total_items_estimate.toLocaleString('pt-BR')}
              </Typography>
            </Grid>
          </Grid>

          <Box sx={{ display: 'grid', gap: 1 }}>
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
            <Box>
              <Typography variant="caption" color="text.secondary">
                % sem área de pintura
              </Typography>
              <PercentIndicator value={row.pct_without_paint_area} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                % sem material
              </Typography>
              <PercentIndicator value={row.pct_without_material} />
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
