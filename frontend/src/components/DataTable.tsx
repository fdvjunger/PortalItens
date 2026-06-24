import {
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { SpecItem } from '../api/specItemsApi';

import EmptyState from './common/EmptyState';

interface DataTableProps {
  columns: string[];
  rows: SpecItem[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange: (column: string) => void;
  onView: (id: number) => void;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

export default function DataTable({
  columns,
  rows,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onView,
}: DataTableProps) {
  if (!rows.length) {
    return <EmptyState title="Nenhum registro encontrado" description="Ajuste os filtros ou refine a busca." />;
  }

  return (
    <Paper elevation={1}>
      <TableContainer sx={{ maxHeight: '70vh' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ações</TableCell>
              {columns.map((column) => (
                <TableCell key={column}>
                  <TableSortLabel
                    active={sortBy === column}
                    direction={sortBy === column ? sortDir : 'asc'}
                    onClick={() => onSortChange(column)}
                  >
                    {column}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <IconButton size="small" onClick={() => onView(row.id)} aria-label="Ver detalhe">
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </TableCell>
                {columns.map((column) => (
                  <TableCell key={`${row.id}-${column}`}>
                    {formatValue(row[column])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, newPage) => onPageChange(newPage)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[25, 50, 100]}
        labelRowsPerPage="Linhas por página"
      />
    </Paper>
  );
}
