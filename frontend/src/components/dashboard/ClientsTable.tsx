import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ClientSummaryRow } from '../../api/specItemsApi';
import PercentIndicator from './PercentIndicator';
import { clientePath } from '../../utils/navigation';

interface ClientsTableProps {
  rows: ClientSummaryRow[];
}

export default function ClientsTable({ rows }: ClientsTableProps) {
  const navigate = useNavigate();

  return (
    <TableContainer component={Paper} elevation={0}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Cliente</TableCell>
            <TableCell align="right">Specs</TableCell>
            <TableCell align="right">Ocorrências</TableCell>
            <TableCell align="right">Itens (est.)</TableCell>
            <TableCell>% sem peso</TableCell>
            <TableCell>% sem AlterDataID</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.slice(0, 15).map((row) => (
            <TableRow
              key={row.cliente}
              hover
              sx={{ cursor: 'pointer' }}
              onClick={() => navigate(clientePath(row.cliente))}
            >
              <TableCell sx={{ fontWeight: 600 }}>{row.cliente}</TableCell>
              <TableCell align="right">{row.total_specs.toLocaleString('pt-BR')}</TableCell>
              <TableCell align="right">{row.total_occurrences.toLocaleString('pt-BR')}</TableCell>
              <TableCell align="right">{row.total_items_estimate.toLocaleString('pt-BR')}</TableCell>
              <TableCell sx={{ minWidth: 130 }}>
                <PercentIndicator value={row.pct_without_weight} />
              </TableCell>
              <TableCell sx={{ minWidth: 130 }}>
                <PercentIndicator value={row.pct_without_alterdata} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
