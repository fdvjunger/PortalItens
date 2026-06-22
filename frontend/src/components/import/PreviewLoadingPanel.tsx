import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

export function getPreviewLoadingTitle(
  status?: string | null,
  phase?: string | null,
): string {
  if (status === 'PREVIEW_STARTING') return 'Preparando preview...';
  if (phase === 'queued') return 'Preview enfileirado...';
  if (phase === 'starting') return 'Preparando preview...';
  if (phase === 'resetting' || phase === 'generating_preview') return 'Preparando dados...';
  if (phase === 'processing') return 'Processando linhas...';
  if (phase === 'completed') return 'Finalizando preview...';
  if (status === 'PREVIEWING') return 'Gerando preview da importação...';
  return 'Gerando preview da importação...';
}

function formatPhaseLabel(phase?: string | null): string {
  if (!phase) return 'Aguardando fase...';
  const labels: Record<string, string> = {
    queued: 'Enfileirado',
    starting: 'Iniciando',
    resetting: 'Preparando dados',
    generating_preview: 'Gerando preview',
    processing: 'Processando linhas',
    completed: 'Concluído',
    failed: 'Falhou',
  };
  return labels[phase] ?? phase;
}

type PreviewLoadingPanelProps = {
  runId: number | string;
  status?: string | null;
  phase?: string | null;
  progressCurrent?: number | null;
  progressTotal?: number | null;
  progressPercent?: number | null;
  message?: string | null;
  onRefreshStatus?: () => void;
  refreshing?: boolean;
};

export function PreviewLoadingPanel({
  runId,
  status,
  phase,
  progressCurrent,
  progressTotal,
  progressPercent,
  message,
  onRefreshStatus,
  refreshing = false,
}: PreviewLoadingPanelProps) {
  const hasCounter =
    typeof progressCurrent === 'number' &&
    typeof progressTotal === 'number' &&
    progressTotal > 0;

  const hasProgress =
    hasCounter &&
    typeof progressPercent === 'number' &&
    Number.isFinite(progressPercent) &&
    progressPercent >= 0;

  const safePercent = Math.max(0, Math.min(100, progressPercent ?? 0));
  const title = getPreviewLoadingTitle(status, phase);
  const displayStatus = status || 'PREVIEWING';

  return (
    <Box sx={{ width: '100%', mt: 1 }}>
      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Stack direction="row" spacing={2} alignItems="center">
              <CircularProgress size={34} />

              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {title}
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  A análise está sendo processada em segundo plano. Aguarde a conclusão antes de aplicar no banco.
                </Typography>
              </Box>
            </Stack>

            <Box>
              {hasProgress ? (
                <LinearProgress
                  variant="determinate"
                  value={safePercent}
                  sx={{ height: 10, borderRadius: 8 }}
                />
              ) : (
                <LinearProgress sx={{ height: 10, borderRadius: 8 }} />
              )}

              <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {hasCounter
                    ? `${progressCurrent?.toLocaleString('pt-BR')} / ${progressTotal?.toLocaleString('pt-BR')} linhas`
                    : 'Preparando processamento...'}
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  {hasProgress ? `${safePercent.toFixed(2)}%` : ''}
                </Typography>
              </Stack>
            </Box>

            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>Run ID:</strong> {runId}
              </Typography>

              <Typography variant="body2">
                <strong>Status:</strong> {displayStatus}
              </Typography>

              <Typography variant="body2">
                <strong>Fase:</strong> {formatPhaseLabel(phase)}
              </Typography>

              <Typography variant="body2">
                <strong>Mensagem:</strong> {message || 'Gerando preview...'}
              </Typography>
            </Stack>

            <Alert severity="info">
              Aguarde. Não feche esta tela. Não clique novamente em Preview — o processamento já está em andamento.
            </Alert>

            {onRefreshStatus && (
              <Box>
                <Button
                  variant="outlined"
                  startIcon={refreshing ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
                  onClick={onRefreshStatus}
                  disabled={refreshing}
                >
                  Atualizar status
                </Button>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
