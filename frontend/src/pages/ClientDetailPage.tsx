import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Grid,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DataQualityTable from '../components/dashboard/DataQualityTable';
import PercentIndicator from '../components/dashboard/PercentIndicator';
import SectionHeader from '../components/dashboard/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import DataTable from '../components/DataTable';
import {
  ClientDetail,
  SpecItem,
  getApiErrorMessage,
  getClientDetail,
  getSpecItems,
} from '../api/specItemsApi';
import { decodeRouteParam, specPath } from '../utils/navigation';
import { buildDataQualitySummary } from '../utils/dataQualitySummary';

const ITEM_COLUMNS = ['id', 'spec_id', 'item_type', 'short_code', 'schedule', 'material_description', 'weight', 'alterDataID'];

export default function ClientDetailPage() {
  const { cliente: clienteParam } = useParams();
  const cliente = decodeRouteParam(clienteParam);
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SpecItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const loadDetail = useCallback(async () => {
    if (!cliente) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getClientDetail(cliente, { include_external_items: 'false' });
      setDetail(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [cliente]);

  const loadItems = useCallback(async () => {
    if (!cliente) return;
    try {
      const response = await getSpecItems({
        page: page + 1,
        page_size: pageSize,
        cliente,
        include_external_items: 'false',
        sort_by: 'id',
        sort_dir: 'desc',
      });
      setRows(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [cliente, page, pageSize]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  if (!cliente) {
    return <EmptyState title="Cliente não informado" />;
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/dashboard" underline="hover" color="inherit">
          Dashboard
        </Link>
        <Link component={RouterLink} to="/clientes" underline="hover" color="inherit">
          Clientes
        </Link>
        <Typography color="text.primary">{cliente}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          {cliente}
        </Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/clientes')}>
          Voltar
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading || !detail ? (
        <TableSkeleton columns={4} rows={4} />
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={5}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                  Resumo do cliente
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Specs</Typography>
                    <Typography variant="body1" fontWeight={700}>{detail.summary.total_specs.toLocaleString('pt-BR')}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Ocorrências</Typography>
                    <Typography variant="body1" fontWeight={700}>{detail.summary.total_occurrences.toLocaleString('pt-BR')}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Itens produtivos</Typography>
                    <Typography variant="body1" fontWeight={700}>{detail.summary.total_items_estimate.toLocaleString('pt-BR')}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
            <Grid item xs={12} md={7}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                  Indicadores de qualidade
                </Typography>
                <Grid container spacing={2}>
                  {[
                    ['% sem peso', detail.summary.pct_without_weight],
                    ['% sem AlterDataID', detail.summary.pct_without_alterdata],
                    ['% sem área de pintura', detail.summary.pct_without_paint_area],
                    ['% sem material', detail.summary.pct_without_material],
                  ].map(([label, value]) => (
                    <Grid item xs={12} sm={6} key={String(label)}>
                      <Typography variant="caption" color="text.secondary">
                        {label}
                      </Typography>
                      <PercentIndicator value={value as number} />
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>
          </Grid>

          <Box sx={{ mb: 3 }}>
            <SectionHeader title="Specs do cliente" subtitle="Clique em uma spec para ver detalhes." />
            {detail.specs.length ? (
              <TableContainer component={Paper} elevation={0}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Spec</TableCell>
                      <TableCell>Revisão</TableCell>
                      <TableCell align="right">Ocorrências</TableCell>
                      <TableCell align="right">Itens produtivos</TableCell>
                      <TableCell>% sem peso</TableCell>
                      <TableCell>% sem AlterDataID</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.specs.map((spec) => (
                      <TableRow
                        key={spec.spec_id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(specPath(spec.spec_id))}
                      >
                        <TableCell sx={{ fontWeight: 600 }}>{spec.spec_id}</TableCell>
                        <TableCell>{spec.revision || '—'}</TableCell>
                        <TableCell align="right">{spec.total_occurrences.toLocaleString('pt-BR')}</TableCell>
                        <TableCell align="right">{spec.total_items_estimate.toLocaleString('pt-BR')}</TableCell>
                        <TableCell sx={{ minWidth: 120 }}>
                          <PercentIndicator value={spec.pct_without_weight} />
                        </TableCell>
                        <TableCell sx={{ minWidth: 120 }}>
                          <PercentIndicator value={spec.pct_without_alterdata} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <EmptyState title="Nenhuma spec encontrada" />
            )}
          </Box>

          {detail.quality_by_family.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <SectionHeader title="Qualidade por família" />
              <DataQualityTable
                rows={detail.quality_by_family}
                summary={buildDataQualitySummary(detail.total_occurrences, detail.distribution)}
                maxHeight={420}
              />
            </Box>
          )}
        </>
      )}

      <Box sx={{ mt: 4 }}>
        <SectionHeader title="Itens cadastrados" subtitle="Ocorrências deste cliente nas specs." />
        {rows.length ? (
          <DataTable
            columns={ITEM_COLUMNS}
            rows={rows}
            total={total}
            page={page}
            pageSize={pageSize}
            sortBy="id"
            sortDir="desc"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(0);
            }}
            onSortChange={() => undefined}
            onView={(id) => navigate(`/spec-items/${id}`)}
          />
        ) : (
          !loading && <EmptyState title="Nenhum item encontrado" />
        )}
      </Box>
    </Box>
  );
}
