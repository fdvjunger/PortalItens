import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { FamilyQualityRow } from '../../api/specItemsApi';
import PercentIndicator from './PercentIndicator';
import StatusBadge from './StatusBadge';
import { qualitySeverity } from '../../theme/tokens';

interface DataQualityTableProps {
  rows: FamilyQualityRow[];
  maxHeight?: number;
}

function worstSeverity(row: FamilyQualityRow) {
  const values = [
    row.pct_without_weight,
    row.pct_without_alterdata,
    row.pct_without_paint_area,
    row.pct_without_material,
  ];
  const worst = Math.max(...values);
  return qualitySeverity(worst);
}

export default function DataQualityTable({ rows, maxHeight = 480 }: DataQualityTableProps) {
  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{
        maxHeight,
        overflow: 'auto',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ bgcolor: 'background.paper' }}>Família / Item Type</TableCell>
            <TableCell align="right" sx={{ bgcolor: 'background.paper' }}>
              Ocorrências
            </TableCell>
            <TableCell sx={{ bgcolor: 'background.paper' }}>% sem peso</TableCell>
            <TableCell sx={{ bgcolor: 'background.paper' }}>% sem AlterDataID</TableCell>
            <TableCell sx={{ bgcolor: 'background.paper' }}>% sem área pintura</TableCell>
            <TableCell sx={{ bgcolor: 'background.paper' }}>% sem material</TableCell>
            <TableCell sx={{ bgcolor: 'background.paper' }}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.item_type} hover>
              <TableCell sx={{ fontWeight: 600 }}>{row.item_type}</TableCell>
              <TableCell align="right">{row.total.toLocaleString('pt-BR')}</TableCell>
              <TableCell sx={{ minWidth: 140 }}>
                <PercentIndicator value={row.pct_without_weight} />
              </TableCell>
              <TableCell sx={{ minWidth: 140 }}>
                <PercentIndicator value={row.pct_without_alterdata} />
              </TableCell>
              <TableCell sx={{ minWidth: 140 }}>
                <PercentIndicator value={row.pct_without_paint_area} />
              </TableCell>
              <TableCell sx={{ minWidth: 140 }}>
                <PercentIndicator value={row.pct_without_material} />
              </TableCell>
              <TableCell>
                <StatusBadge
                  label={
                    worstSeverity(row) === 'good'
                      ? 'Bom'
                      : worstSeverity(row) === 'attention'
                        ? 'Atenção'
                        : worstSeverity(row) === 'warning'
                          ? 'Ruim'
                          : 'Crítico'
                  }
                  severity={worstSeverity(row)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
