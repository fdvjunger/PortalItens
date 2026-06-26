import { useMemo, useState } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { FamilyQualityRow } from '../../api/specItemsApi';
import PercentIndicator from './PercentIndicator';
import { DataQualitySummary } from '../../utils/dataQualitySummary';
import { stepTokens } from '../../theme/tokens';

type SortColumn =
  | 'item_type'
  | 'total'
  | 'pct_without_weight'
  | 'pct_without_paint_area'
  | 'pct_without_material'
  | 'pct_without_alterdata';

interface DataQualityTableProps {
  rows: FamilyQualityRow[];
  summary?: DataQualitySummary;
  maxHeight?: number | 'none';
  defaultSortBy?: SortColumn;
  defaultSortDir?: 'asc' | 'desc';
}

const COLUMNS: Array<{ id: SortColumn; label: string; align?: 'right' }> = [
  { id: 'item_type', label: 'Família / Item Type' },
  { id: 'total', label: 'Itens', align: 'right' },
  { id: 'pct_without_weight', label: '% sem peso' },
  { id: 'pct_without_paint_area', label: '% sem área pintura' },
  { id: 'pct_without_material', label: '% sem material' },
  { id: 'pct_without_alterdata', label: '% sem AlterDataID' },
];

function compareRows(a: FamilyQualityRow, b: FamilyQualityRow, sortBy: SortColumn, sortDir: 'asc' | 'desc') {
  const dir = sortDir === 'asc' ? 1 : -1;
  if (sortBy === 'item_type') {
    return a.item_type.localeCompare(b.item_type, 'pt-BR') * dir;
  }
  return ((a[sortBy] as number) - (b[sortBy] as number)) * dir;
}

function summaryCellSx(align?: 'right') {
  return {
    bgcolor: `${stepTokens.primary}10`,
    borderBottom: `2px solid ${stepTokens.border}`,
    whiteSpace: 'nowrap' as const,
    verticalAlign: 'bottom' as const,
    py: 1.5,
    ...(align && { textAlign: align }),
  };
}

function headerCellSx(colId: SortColumn) {
  return {
    bgcolor: 'background.paper',
    whiteSpace: 'nowrap' as const,
    borderBottom: 1,
    borderColor: 'divider',
    ...(colId !== 'item_type' && { minWidth: { xs: 120, sm: 140 } }),
    ...(colId === 'item_type' && { minWidth: { xs: 140, sm: 200 } }),
    ...(colId === 'total' && { minWidth: { xs: 80, sm: 100 } }),
  };
}

export default function DataQualityTable({
  rows,
  summary,
  maxHeight = 480,
  defaultSortBy = 'total',
  defaultSortDir = 'desc',
}: DataQualityTableProps) {
  const [sortBy, setSortBy] = useState<SortColumn>(defaultSortBy);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => compareRows(a, b, sortBy, sortDir)),
    [rows, sortBy, sortDir],
  );

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir(column === 'item_type' ? 'asc' : 'desc');
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <TableContainer
        sx={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          ...(maxHeight !== 'none' && summary && { maxHeight: maxHeight + 72 }),
          ...(maxHeight !== 'none' && !summary && { maxHeight }),
        }}
      >
        <Table size="small" sx={{ minWidth: { xs: 720, md: '100%' } }}>
          {summary && (
            <TableHead>
              <TableRow>
                <TableCell sx={summaryCellSx()}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Total geral
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="text.secondary">
                    Todas as famílias
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={summaryCellSx('right')}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Itens
                  </Typography>
                  <Typography variant="h6" fontWeight={700} sx={{ color: stepTokens.neutral900, lineHeight: 1.2 }}>
                    {summary.totalItems.toLocaleString('pt-BR')}
                  </Typography>
                </TableCell>
                <TableCell sx={summaryCellSx()}>
                  <PercentIndicator value={summary.pctWithoutWeight} label="Geral" />
                </TableCell>
                <TableCell sx={summaryCellSx()}>
                  <PercentIndicator value={summary.pctWithoutPaintArea} label="Geral" />
                </TableCell>
                <TableCell sx={summaryCellSx()}>
                  <PercentIndicator value={summary.pctWithoutMaterial} label="Geral" />
                </TableCell>
                <TableCell sx={summaryCellSx()}>
                  <PercentIndicator value={summary.pctWithoutAlterdata} label="Geral" />
                </TableCell>
              </TableRow>
            </TableHead>
          )}

          <TableHead>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableCell key={col.id} align={col.align} sx={headerCellSx(col.id)}>
                  <TableSortLabel
                    active={sortBy === col.id}
                    direction={sortBy === col.id ? sortDir : 'asc'}
                    onClick={() => handleSort(col.id)}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {sortedRows.map((row) => (
              <TableRow key={row.item_type} hover>
                <TableCell sx={{ fontWeight: 600, maxWidth: { xs: 160, sm: 240, md: 'none' } }}>
                  {row.item_type}
                </TableCell>
                <TableCell align="right">{row.total.toLocaleString('pt-BR')}</TableCell>
                <TableCell>
                  <PercentIndicator value={row.pct_without_weight} />
                </TableCell>
                <TableCell>
                  <PercentIndicator value={row.pct_without_paint_area} />
                </TableCell>
                <TableCell>
                  <PercentIndicator value={row.pct_without_material} />
                </TableCell>
                <TableCell>
                  <PercentIndicator value={row.pct_without_alterdata} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
