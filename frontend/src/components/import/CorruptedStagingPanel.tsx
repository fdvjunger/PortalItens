import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import type { RawVsStagingDiagnostic } from '../../api/specItemsApi';

type CorruptedStagingPanelProps = {
  runId: number | string;
  message?: string | null;
  onReanalyze?: () => void;
  onNewUpload?: () => void;
  onRefreshStatus?: () => void;
  onDiagnose?: () => void;
  refreshing?: boolean;
  diagnosing?: boolean;
  diagnostic?: RawVsStagingDiagnostic | null;
  diagnosticError?: string | null;
};

function diagnosisSeverity(diagnosis?: RawVsStagingDiagnostic['diagnosis']) {
  switch (diagnosis) {
    case 'STAGING_BUG':
      return 'warning' as const;
    case 'CONTAMINATED_SOURCE':
      return 'error' as const;
    case 'OK':
      return 'success' as const;
    default:
      return 'info' as const;
  }
}

export function CorruptedStagingPanel({
  runId,
  message,
  onReanalyze,
  onNewUpload,
  onRefreshStatus,
  onDiagnose,
  refreshing = false,
  diagnosing = false,
  diagnostic,
  diagnosticError,
}: CorruptedStagingPanelProps) {
  return (
    <Box sx={{ mt: 1 }}>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Alert severity="error">
              Este run está corrompido e não pode ser aplicado.
            </Alert>

            <Typography variant="h6" fontWeight={700}>
              Run corrompido
            </Typography>

            <Typography variant="body2">
              <strong>Run ID:</strong> {runId}
            </Typography>

            <Typography variant="body2">
              {message
                || 'Foram detectados valores numéricos incompatíveis no staging. Use o diagnóstico para confirmar se o arquivo Excel já veio corrompido ou se houve erro durante o staging.'}
            </Typography>

            <Stack direction="row" spacing={2} flexWrap="wrap">
              {onDiagnose && (
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={diagnosing ? <CircularProgress size={18} color="inherit" /> : <BugReportIcon />}
                  onClick={onDiagnose}
                  disabled={diagnosing || refreshing}
                >
                  Diagnosticar valores do Excel
                </Button>
              )}

              {onReanalyze && (
                <Button variant="contained" onClick={onReanalyze} disabled={refreshing || diagnosing}>
                  Reanalisar arquivo
                </Button>
              )}

              {onNewUpload && (
                <Button variant="outlined" onClick={onNewUpload} disabled={refreshing || diagnosing}>
                  Enviar novo arquivo
                </Button>
              )}

              {onRefreshStatus && (
                <Button variant="text" onClick={onRefreshStatus} disabled={refreshing || diagnosing}>
                  Atualizar status
                </Button>
              )}
            </Stack>

            {diagnosticError && (
              <Alert severity="error">{diagnosticError}</Alert>
            )}

            {diagnostic && (
              <Stack spacing={2}>
                <Alert severity={diagnosisSeverity(diagnostic.diagnosis)}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Diagnóstico: {diagnostic.diagnosis}
                  </Typography>
                  <Typography variant="body2">{diagnostic.message}</Typography>
                </Alert>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Linha</TableCell>
                        <TableCell>Coluna</TableCell>
                        <TableCell>Excel cru</TableCell>
                        <TableCell>Tipo Excel</TableCell>
                        <TableCell>Formato Excel</TableCell>
                        <TableCell>Staging</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {diagnostic.samples.map((sample, index) => (
                        <TableRow key={`${sample.excel_row_number}-${sample.column}-${index}`}>
                          <TableCell>{sample.excel_row_number}</TableCell>
                          <TableCell>{sample.column}</TableCell>
                          <TableCell>{sample.excel_raw_value ?? '—'}</TableCell>
                          <TableCell>{sample.excel_python_type ?? '—'}</TableCell>
                          <TableCell>{sample.excel_number_format ?? '—'}</TableCell>
                          <TableCell>{sample.staging_raw_value ?? '—'}</TableCell>
                          <TableCell>{sample.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
