import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import {
  ApplyResult,
  ColumnMappingRow,
  ImportRunDetail,
  ImportRunStatus,
  PreviewError,
  PreviewResult,
  PreviewWarning,
  RawVsStagingDiagnostic,
  analyzeImportExcel,
  applyImport,
  exportImportErrors,
  cancelImport,
  getApiErrorMessage,
  getApiRequestId,
  getImportErrors,
  getImportPreview,
  getImportRawVsStaging,
  getImportRunDetail,
  getImportStatus,
  getImportWarnings,
  reanalyzeImport,
  rebuildImportPreview,
  saveImportMapping,
  startImportPreview,
} from '../api/specItemsApi';
import { PreviewLoadingPanel } from '../components/import/PreviewLoadingPanel';
import { CorruptedStagingPanel } from '../components/import/CorruptedStagingPanel';

const STEPS = ['Upload', 'Mapeamento', 'Preview', 'Aplicação'];
const POLL_MS = 2000;
const TERMINAL_STEPS: ImportStep[] = ['FAILED', 'CORRUPTED_STAGING', 'APPLIED'];

type ImportStep =
  | 'UPLOAD'
  | 'ANALYZING'
  | 'MAPPING'
  | 'PREVIEW_STARTING'
  | 'PREVIEWING'
  | 'PREVIEW_READY'
  | 'APPLYING'
  | 'APPLIED'
  | 'FAILED'
  | 'CORRUPTED_STAGING';

function canTransitionStep(
  currentStep: ImportStep,
  nextStep: ImportStep,
  previewIntentRef: MutableRefObject<boolean>,
  options?: { manual?: boolean },
): boolean {
  const manual = options?.manual === true;

  if (
    previewIntentRef.current &&
    !manual &&
    (currentStep === 'PREVIEW_STARTING' || currentStep === 'PREVIEWING') &&
    nextStep === 'MAPPING'
  ) {
    console.warn('[IMPORT][STEP_BLOCKED] Bloqueado retorno automático para MAPPING durante preview', {
      currentStep,
      nextStep,
      previewIntent: previewIntentRef.current,
    });
    return false;
  }

  if (
    previewIntentRef.current &&
    !manual &&
    (currentStep === 'PREVIEW_STARTING' || currentStep === 'PREVIEWING') &&
    nextStep === 'UPLOAD'
  ) {
    console.warn('[IMPORT][TRANSITION_BLOCKED] Bloqueado retorno automático para UPLOAD durante preview', {
      currentStep,
      nextStep,
      previewIntent: previewIntentRef.current,
    });
    return false;
  }

  if (
    !manual &&
    TERMINAL_STEPS.includes(currentStep) &&
    nextStep !== currentStep
  ) {
    console.warn('[IMPORT][TERMINAL_STATE_BLOCKED]', {
      currentStep,
      attemptedNextStep: nextStep,
    });
    return false;
  }

  return true;
}

function stepToActiveStep(step: ImportStep): number {
  switch (step) {
    case 'UPLOAD':
    case 'ANALYZING':
      return 0;
    case 'MAPPING':
      return 1;
    case 'PREVIEW_STARTING':
    case 'PREVIEWING':
    case 'PREVIEW_READY':
    case 'FAILED':
    case 'CORRUPTED_STAGING':
      return 2;
    case 'APPLYING':
    case 'APPLIED':
      return 3;
    default:
      return 0;
  }
}

type MappingState = Record<
  string,
  {
    action: 'MAP_TO_EXISTING' | 'IGNORE';
    target_column_name: string;
    confidence: number | null;
  }
>;

export default function ImportExcelPage() {
  const [step, setStep] = useState<ImportStep>('UPLOAD');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [isPreviewRequesting, setIsPreviewRequesting] = useState(false);
  const [mappingSaved, setMappingSaved] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState<ImportRunStatus | null>(null);
  const [runDetail, setRunDetail] = useState<ImportRunDetail | null>(null);
  const [mappingState, setMappingState] = useState<MappingState>({});
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [errorsPage, setErrorsPage] = useState({ page: 0, rows: [] as PreviewError[], total: 0 });
  const [warningsPage, setWarningsPage] = useState({ page: 0, rows: [] as PreviewWarning[], total: 0 });
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [diagnosingExcel, setDiagnosingExcel] = useState(false);
  const [excelDiagnostic, setExcelDiagnostic] = useState<RawVsStagingDiagnostic | null>(null);
  const [excelDiagnosticError, setExcelDiagnosticError] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFailCountRef = useRef(0);
  const previewIntentRef = useRef(false);
  const previewRequestInFlightRef = useRef(false);
  const pollingRunIdRef = useRef<number | null>(null);
  const stepRef = useRef<ImportStep>('UPLOAD');
  const currentRunIdRef = useRef<number | null>(null);
  const flowVersionRef = useRef(0);
  const runDetailRequestInFlightRef = useRef(false);
  const previewLoadInFlightRef = useRef(false);
  const statusAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);

  const activeStep = stepToActiveStep(step);

  const isStaleResponse = useCallback((requestRunId: number, requestFlowVersion: number) => {
    if (requestRunId !== currentRunIdRef.current) {
      console.warn('[IMPORT][STALE_RESPONSE_IGNORED] runId diferente', {
        requestRunId,
        currentRunId: currentRunIdRef.current,
      });
      return true;
    }
    if (requestFlowVersion !== flowVersionRef.current) {
      console.warn('[IMPORT][STALE_RESPONSE_IGNORED] flowVersion diferente', {
        requestFlowVersion,
        currentFlowVersion: flowVersionRef.current,
      });
      return true;
    }
    return false;
  }, []);

  const safeSetStep = useCallback((nextStep: ImportStep, reason: string, options?: { manual?: boolean }) => {
    if (nextStep === 'MAPPING') {
      console.warn('[IMPORT][TRYING_TO_GO_MAPPING]', {
        reason,
        currentStep: stepRef.current,
        backendStatus: jobStatus?.status,
        previewIntent: previewIntentRef.current,
        runId: currentRunIdRef.current,
      });
    }

    setStep((currentStep) => {
      if (!canTransitionStep(currentStep, nextStep, previewIntentRef, options)) {
        console.warn('[IMPORT][TRANSITION_BLOCKED]', {
          from: currentStep,
          to: nextStep,
          reason,
        });
        return currentStep;
      }

      console.info('[IMPORT][TRANSITION]', {
        from: currentStep,
        to: nextStep,
        reason,
        manual: options?.manual === true,
        previewIntent: previewIntentRef.current,
        runId: currentRunIdRef.current,
        flowVersion: flowVersionRef.current,
      });

      stepRef.current = nextStep;
      return nextStep;
    });
  }, [jobStatus?.status]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    pollingRunIdRef.current = null;
    setPolling(false);
  }, []);

  const goBackToMapping = useCallback(() => {
    previewIntentRef.current = false;
    previewRequestInFlightRef.current = false;
    safeSetStep('MAPPING', 'manual_back_to_mapping', { manual: true });
  }, [safeSetStep]);

  const loadRunDetailOnce = useCallback(async (id: number, requestFlowVersion: number) => {
    if (runDetailRequestInFlightRef.current) {
      console.warn('[IMPORT][DETAIL] Ignorado: detalhe já está carregando', { runId: id });
      return;
    }
    if (isStaleResponse(id, requestFlowVersion)) return;
    if (['PREVIEWING', 'PREVIEW_STARTING', 'CORRUPTED_STAGING', 'FAILED'].includes(stepRef.current)) {
      console.warn('[IMPORT][DETAIL] Ignorado: step não permite detalhe', { step: stepRef.current, runId: id });
      return;
    }

    try {
      runDetailRequestInFlightRef.current = true;
      detailAbortRef.current?.abort();
      detailAbortRef.current = new AbortController();
      const detail = await getImportRunDetail(id, detailAbortRef.current.signal);
      if (isStaleResponse(id, requestFlowVersion)) return;
      console.info('[IMPORT][DETAIL_RECEIVED]', { runId: id });
      setRunDetail(detail);
      initMappingState(detail);
    } catch (err) {
      if ((err as { name?: string }).name === 'CanceledError' || (err as { code?: string }).code === 'ERR_CANCELED') {
        return;
      }
      throw err;
    } finally {
      runDetailRequestInFlightRef.current = false;
    }
  }, [isStaleResponse]);

  const loadPreviewOnce = useCallback(async (id: number, requestFlowVersion: number) => {
    if (previewLoadInFlightRef.current) {
      console.warn('[IMPORT][PREVIEW] Ignorado: preview já está carregando', { runId: id });
      return;
    }
    if (isStaleResponse(id, requestFlowVersion)) return;

    try {
      previewLoadInFlightRef.current = true;
      previewAbortRef.current?.abort();
      previewAbortRef.current = new AbortController();
      const previewData = await getImportPreview(id, previewAbortRef.current.signal);
      if (isStaleResponse(id, requestFlowVersion)) return;
      console.info('[IMPORT][PREVIEW_RECEIVED]', { runId: id, status: previewData.status });
      setPreview(previewData);
      if (previewData.warnings) {
        setWarningsPage({ page: 0, rows: previewData.warnings, total: previewData.warnings.length });
      }
      if (previewData.status === 'PREVIEW_READY' || previewData.ok !== false) {
        await loadPaginatedIssues(id);
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'CanceledError' || (err as { code?: string }).code === 'ERR_CANCELED') {
        return;
      }
      throw err;
    } finally {
      previewLoadInFlightRef.current = false;
    }
  }, [isStaleResponse]);

  const initMappingState = (detail: ImportRunDetail) => {
    const state: MappingState = {};
    detail.column_mappings.forEach((row) => {
      state[row.excel_column_name] = {
        action: row.action,
        target_column_name: row.target_column_name ?? '',
        confidence: row.confidence,
      };
    });
    setMappingState(state);
  };

  const loadPaginatedIssues = async (id: number) => {
    const [errors, warnings] = await Promise.all([
      getImportErrors(id, 1, 100),
      getImportWarnings(id, 1, 100),
    ]);
    setErrorsPage({ page: 0, rows: errors.items, total: errors.total });
    setWarningsPage({ page: 0, rows: warnings.items, total: warnings.total });
  };

  const resetPreviewIssueState = () => {
    setErrorsPage({ page: 0, rows: [], total: 0 });
    setWarningsPage({ page: 0, rows: [], total: 0 });
  };

  const applyStatusFromBackend = useCallback(async (
    data: ImportRunStatus,
    options: {
      reason: string;
      requestRunId: number;
      requestFlowVersion: number;
      loadPreview?: boolean;
      loadMappingDetail?: boolean;
    },
  ) => {
    if (isStaleResponse(options.requestRunId, options.requestFlowVersion)) return;

    setJobStatus(data);

    console.info('[IMPORT][STATUS_RECEIVED]', {
      runId: data.run_id,
      backendStatus: data.status,
      phase: data.phase,
      progressCurrent: data.progress_current,
      progressTotal: data.progress_total,
      progressPercent: data.progress_percent,
      localStep: stepRef.current,
      previewIntent: previewIntentRef.current,
      reason: options.reason,
    });

    const backendStatus = data.status;

    if (backendStatus === 'PREVIEWING') {
      safeSetStep('PREVIEWING', options.reason);
      return;
    }

    if (backendStatus === 'PREVIEW_READY') {
      previewIntentRef.current = false;
      previewRequestInFlightRef.current = false;
      stopPolling();
      safeSetStep('PREVIEW_READY', options.reason);
      if (options.loadPreview) {
        await loadPreviewOnce(options.requestRunId, options.requestFlowVersion);
      }
      return;
    }

    if (backendStatus === 'CORRUPTED_STAGING') {
      previewIntentRef.current = false;
      previewRequestInFlightRef.current = false;
      detailAbortRef.current?.abort();
      previewAbortRef.current?.abort();
      stopPolling();
      setError(
        data.error_message
        || data.message
        || 'Run corrompido. Reanalise o arquivo original.',
      );
      safeSetStep('CORRUPTED_STAGING', options.reason);
      return;
    }

    if (backendStatus === 'FAILED' || backendStatus === 'CANCELLED') {
      previewIntentRef.current = false;
      previewRequestInFlightRef.current = false;
      detailAbortRef.current?.abort();
      previewAbortRef.current?.abort();
      stopPolling();
      setError(data.error_message || data.message || 'Erro durante a importação.');
      safeSetStep('FAILED', options.reason);
      return;
    }

    if (backendStatus === 'APPLYING') {
      safeSetStep('APPLYING', options.reason);
      return;
    }

    if (backendStatus === 'APPLIED') {
      previewIntentRef.current = false;
      previewRequestInFlightRef.current = false;
      setApplyResult({
        ok: true,
        run_id: data.run_id,
        status: 'APPLIED',
        inserted_rows: data.summary?.insert_rows,
        updated_rows: data.summary?.update_rows,
        unchanged_rows: data.summary?.unchanged_rows,
        error_rows: data.summary?.error_rows,
      });
      stopPolling();
      safeSetStep('APPLIED', options.reason);
      return;
    }

    if (backendStatus === 'MAPPING_REQUIRED') {
      if (previewIntentRef.current || TERMINAL_STEPS.includes(stepRef.current)) {
        console.warn('[IMPORT][STATUS_IGNORED] Ignorando MAPPING_REQUIRED', {
          runId: data.run_id,
          backendStatus,
          localStep: stepRef.current,
          previewIntent: previewIntentRef.current,
        });
        if (previewIntentRef.current) {
          safeSetStep('PREVIEWING', options.reason);
        }
        return;
      }

      safeSetStep('MAPPING', options.reason);
      stopPolling();
      if (options.loadMappingDetail) {
        await loadRunDetailOnce(options.requestRunId, options.requestFlowVersion);
      }
      return;
    }

    if (backendStatus === 'ANALYZING') {
      safeSetStep('ANALYZING', options.reason);
      return;
    }

    console.error('[IMPORT][UNKNOWN_STATUS]', { backendStatus, reason: options.reason });
    if (!TERMINAL_STEPS.includes(stepRef.current)) {
      safeSetStep('FAILED', `${options.reason}:unknown_status`);
    }
  }, [isStaleResponse, loadPreviewOnce, loadRunDetailOnce, stopPolling, safeSetStep]);

  const startPolling = useCallback((id: number) => {
    if (pollingRunIdRef.current === id && pollingRef.current !== null) {
      return;
    }

    stopPolling();
    pollingRunIdRef.current = id;
    setPolling(true);
    pollFailCountRef.current = 0;

    const formatPollError = (err: unknown) => {
      const requestId = getApiRequestId(err);
      const message = getApiErrorMessage(err);
      return requestId
        ? `Erro ao carregar detalhes da importação. Verifique o terminal do backend. ${message} (request_id: ${requestId})`
        : `Erro ao carregar detalhes da importação. Verifique o terminal do backend. ${message}`;
    };

    const poll = async () => {
      const requestRunId = id;
      const requestFlowVersion = flowVersionRef.current;

      try {
        statusAbortRef.current?.abort();
        statusAbortRef.current = new AbortController();
        const status = await getImportStatus(id, statusAbortRef.current.signal);
        await applyStatusFromBackend(status, {
          reason: 'polling',
          requestRunId,
          requestFlowVersion,
          loadPreview: true,
          loadMappingDetail: true,
        });
        pollFailCountRef.current = 0;
      } catch (err) {
        if ((err as { name?: string }).name === 'CanceledError' || (err as { code?: string }).code === 'ERR_CANCELED') {
          return;
        }
        pollFailCountRef.current += 1;
        setError(formatPollError(err));
        console.error('[IMPORT][STATUS][ERROR]', {
          runId: id,
          error: err,
          message: getApiErrorMessage(err),
        });
        if (pollFailCountRef.current >= 3) {
          previewIntentRef.current = false;
          previewRequestInFlightRef.current = false;
          stopPolling();
          safeSetStep('FAILED', 'polling_failed');
        }
      }
    };

    poll();
    pollingRef.current = setInterval(poll, POLL_MS);
  }, [applyStatusFromBackend, stopPolling, safeSetStep]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleAnalyze = async () => {
    if (!file) {
      setError('Selecione um arquivo .xlsx');
      return;
    }

    setLoading(true);
    setError(null);
    setInfoMessage(null);
    setPreview(null);
    setApplyResult(null);
    setRunDetail(null);
    setMappingSaved(false);
    previewIntentRef.current = false;
    previewRequestInFlightRef.current = false;
    flowVersionRef.current += 1;
    currentRunIdRef.current = null;
    detailAbortRef.current?.abort();
    previewAbortRef.current?.abort();
    safeSetStep('UPLOAD', 'new_analyze', { manual: true });

    safeSetStep('ANALYZING', 'analyze_started', { manual: true });
    setPolling(true);

    try {
      const result = await analyzeImportExcel(file);
      flowVersionRef.current += 1;
      currentRunIdRef.current = result.run_id;
      setRunId(result.run_id);
      setJobStatus({
        ok: true,
        run_id: result.run_id,
        status: result.status,
        phase: 'queued',
        progress_current: 0,
        progress_total: 0,
        progress_percent: 0,
        message: result.message,
      });
      startPolling(result.run_id);
    } catch (err) {
      setPolling(false);
      safeSetStep('UPLOAD', 'analyze_failed', { manual: true });
      setError(getApiErrorMessage(err));
      console.error('[IMPORT] analyze failed', err);
    } finally {
      setLoading(false);
    }
  };

  const buildMappingsPayload = () => {
    if (!runDetail) return [];
    return runDetail.column_mappings.map((row) => {
      const state = mappingState[row.excel_column_name];
      return {
        excel_column_name: row.excel_column_name,
        action: state?.action ?? 'IGNORE',
        target_column_name: state?.action === 'MAP_TO_EXISTING' ? state.target_column_name : null,
        confidence: state?.confidence ?? row.confidence,
      };
    });
  };

  const handleSaveMapping = async () => {
    if (!runId || !runDetail) return;

    const hasIgnoreUnknown = runDetail.column_mappings.some((row) => {
      const state = mappingState[row.excel_column_name];
      return state?.action === 'IGNORE';
    });
    if (hasIgnoreUnknown && jobStatus?.unknown_columns?.length) {
      const confirmed = window.confirm(
        'Existem colunas marcadas como IGNORE. Deseja continuar mesmo assim?',
      );
      if (!confirmed) return;
    }

    setLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      const result = await saveImportMapping(runId, { mappings: buildMappingsPayload() });
      setMappingSaved(true);
      setInfoMessage(result.message || 'Mapeamento salvo.');
      safeSetStep('MAPPING', 'mapping_saved', { manual: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
      console.error('[IMPORT] mapping failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePreview = async () => {
    if (!runId) return;

    if (
      previewRequestInFlightRef.current ||
      step === 'PREVIEW_STARTING' ||
      step === 'PREVIEWING'
    ) {
      console.warn('[IMPORT][PREVIEW] Clique ignorado: preview já em andamento', {
        runId,
        step,
        previewRequestInFlight: previewRequestInFlightRef.current,
      });
      setInfoMessage('Preview já está em processamento.');
      return;
    }

    previewIntentRef.current = true;
    previewRequestInFlightRef.current = true;
    setIsPreviewRequesting(true);
    setError(null);
    setInfoMessage(null);
    setPreview(null);
    resetPreviewIssueState();
    safeSetStep('PREVIEW_STARTING', 'preview_requested', { manual: true });

    try {
      console.info('[IMPORT][PREVIEW] Iniciando preview', { runId });
      startPolling(runId);

      if (!mappingSaved) {
        await saveImportMapping(runId, { mappings: buildMappingsPayload() });
        setMappingSaved(true);
      }

      const response = await startImportPreview(runId);
      console.info('[IMPORT][PREVIEW] Backend aceitou preview', { runId, response });

      if (response.already_ready) {
        previewIntentRef.current = false;
        previewRequestInFlightRef.current = false;
        safeSetStep('PREVIEW_READY', 'preview_already_ready', { manual: true });
        stopPolling();
        await loadPreviewOnce(runId, flowVersionRef.current);
        return;
      }

      if (response.already_running || response.status === 'PREVIEWING') {
        setInfoMessage(response.message || 'Preview já está em processamento.');
      }

      safeSetStep('PREVIEWING', 'preview_accepted', { manual: true });
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { detail?: { message?: string } | string } } };
      console.error('[IMPORT][PREVIEW] Erro ao iniciar preview', {
        runId,
        status: apiErr?.response?.status,
        response: apiErr?.response?.data,
        message: getApiErrorMessage(err),
      });

      if (apiErr?.response?.status === 409) {
        setInfoMessage('Preview já está em processamento.');
        safeSetStep('PREVIEWING', 'preview_accepted', { manual: true });
        startPolling(runId);
        return;
      }

      previewIntentRef.current = false;
      previewRequestInFlightRef.current = false;
      safeSetStep('FAILED', 'preview_failed', { manual: true });
      setError(getApiErrorMessage(err));
      stopPolling();
    } finally {
      previewRequestInFlightRef.current = false;
      setIsPreviewRequesting(false);
    }
  };

  const handleReanalyze = async () => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const result = await reanalyzeImport(runId);
      if (!result.ok) {
        setError(result.message || 'Não foi possível reanalisar o arquivo.');
        return;
      }
      previewIntentRef.current = false;
      previewRequestInFlightRef.current = false;
      flowVersionRef.current += 1;
      setMappingSaved(false);
      safeSetStep('ANALYZING', 'reanalyze_started', { manual: true });
      setPolling(true);
      startPolling(runId);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRebuildPreview = async () => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    resetPreviewIssueState();
    previewIntentRef.current = true;
    previewRequestInFlightRef.current = true;
    safeSetStep('PREVIEW_STARTING', 'preview_requested', { manual: true });
    startPolling(runId);
    try {
      await rebuildImportPreview(runId);
      safeSetStep('PREVIEWING', 'preview_accepted', { manual: true });
    } catch (err) {
      previewIntentRef.current = false;
      previewRequestInFlightRef.current = false;
      safeSetStep('FAILED', 'preview_failed', { manual: true });
      setError(getApiErrorMessage(err));
      stopPolling();
    } finally {
      previewRequestInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!runId) return;

    const requestRunId = runId;
    const requestFlowVersion = flowVersionRef.current;

    setRefreshingStatus(true);
    try {
      console.info('[IMPORT][REFRESH_STATUS] Atualizando somente status', {
        runId,
        step,
      });

      statusAbortRef.current?.abort();
      statusAbortRef.current = new AbortController();
      const status = await getImportStatus(runId, statusAbortRef.current.signal);

      console.info('[IMPORT][REFRESH_STATUS][RESPONSE]', status);

      await applyStatusFromBackend(status, {
        reason: 'refresh_status',
        requestRunId,
        requestFlowVersion,
        loadPreview: status.status === 'PREVIEW_READY',
        loadMappingDetail: false,
      });
    } catch (err) {
      if ((err as { name?: string }).name === 'CanceledError' || (err as { code?: string }).code === 'ERR_CANCELED') {
        return;
      }
      console.error('[IMPORT][REFRESH_STATUS][ERROR]', {
        runId,
        error: err,
        message: getApiErrorMessage(err),
      });
      setError('Erro ao atualizar status da importação.');
    } finally {
      setRefreshingStatus(false);
    }
  };

  const handleDiagnoseExcel = async () => {
    if (!runId) return;

    setDiagnosingExcel(true);
    setExcelDiagnosticError(null);

    try {
      console.info('[IMPORT][DIAGNOSE] raw-vs-staging', { runId });
      const result = await getImportRawVsStaging(runId, 20);
      setExcelDiagnostic(result);
      console.info('[IMPORT][DIAGNOSE][RESULT]', result);
    } catch (err) {
      console.error('[IMPORT][DIAGNOSE][ERROR]', { runId, error: err });
      setExcelDiagnosticError(getApiErrorMessage(err));
    } finally {
      setDiagnosingExcel(false);
    }
  };

  const handleApply = async () => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    try {
      await applyImport(runId, 'valid_rows_only');
      safeSetStep('APPLYING', 'apply_started', { manual: true });
      startPolling(runId);
    } catch (err) {
      setError(getApiErrorMessage(err));
      console.error('[IMPORT] apply failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportErrors = async () => {
    if (!runId) return;
    try {
      const blob = await exportImportErrors(runId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `import_run_${runId}_errors.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleCancel = async () => {
    stopPolling();
    if (runId) {
      try {
        await cancelImport(runId);
      } catch (err) {
        console.error('[IMPORT] cancel failed', err);
      }
    }
    resetFlow();
  };

  const resetFlow = () => {
    stopPolling();
    previewIntentRef.current = false;
    previewRequestInFlightRef.current = false;
    flowVersionRef.current += 1;
    currentRunIdRef.current = null;
    safeSetStep('UPLOAD', 'reset_flow', { manual: true });
    setFile(null);
    setRunId(null);
    setJobStatus(null);
    setRunDetail(null);
    setMappingState({});
    setPreview(null);
    setApplyResult(null);
    setError(null);
    setInfoMessage(null);
    setMappingSaved(false);
    setIsPreviewRequesting(false);
    setExcelDiagnostic(null);
    setExcelDiagnosticError(null);
  };

  const updateMapping = (excelColumn: string, field: 'action' | 'target_column_name', value: string) => {
    setMappingState((prev) => ({
      ...prev,
      [excelColumn]: {
        ...prev[excelColumn],
        [field]: value,
        action: field === 'action' ? (value as 'MAP_TO_EXISTING' | 'IGNORE') : prev[excelColumn]?.action ?? 'IGNORE',
        target_column_name: field === 'target_column_name' ? value : prev[excelColumn]?.target_column_name ?? '',
        confidence: prev[excelColumn]?.confidence ?? null,
      },
    }));
  };

  const headerInfo = useMemo(() => ({
    fileName: jobStatus?.file_name ?? runDetail?.run.file_name ?? '—',
    sheetName: jobStatus?.sheet_name ?? runDetail?.run.sheet_name ?? '—',
    totalRows: runDetail?.run.total_rows ?? jobStatus?.progress_total ?? 0,
    status: jobStatus?.status ?? applyResult?.status ?? '—',
  }), [jobStatus, runDetail, applyResult]);

  const previewBusy =
    isPreviewRequesting ||
    previewRequestInFlightRef.current ||
    step === 'PREVIEW_STARTING' ||
    step === 'PREVIEWING';

  const canApply = preview && preview.summary
    ? (preview.summary.can_apply_valid_rows ?? (preview.summary.valid_rows ?? 0) > 0)
      && preview.ok !== false
      && (preview.summary.fatal_errors ?? 0) === 0
      && !polling
    : false;
  const showAnalyzeApplyProgress =
    polling
    && jobStatus
    && ['ANALYZING', 'APPLYING'].includes(jobStatus.status);

  const isAnalyzeLoading = step === 'ANALYZING' || (polling && jobStatus?.status === 'ANALYZING');
  const isPreviewLoading = step === 'PREVIEW_STARTING' || step === 'PREVIEWING';

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Importar Excel</Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={3}><Typography variant="caption" color="text.secondary">Arquivo</Typography><Typography>{headerInfo.fileName}</Typography></Grid>
          <Grid item xs={12} sm={3}><Typography variant="caption" color="text.secondary">Aba</Typography><Typography>{headerInfo.sheetName}</Typography></Grid>
          <Grid item xs={12} sm={3}><Typography variant="caption" color="text.secondary">Total de linhas</Typography><Typography>{headerInfo.totalRows}</Typography></Grid>
          <Grid item xs={12} sm={3}><Typography variant="caption" color="text.secondary">Status</Typography><Typography>{headerInfo.status}</Typography></Grid>
        </Grid>
      </Paper>

      {showAnalyzeApplyProgress && jobStatus && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            Fase: {jobStatus.phase ?? '—'} | {jobStatus.message ?? 'Processando...'}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {jobStatus.progress_current} / {jobStatus.progress_total} ({jobStatus.progress_percent}%)
          </Typography>
          <LinearProgress
            variant={jobStatus.progress_total > 0 ? 'determinate' : 'indeterminate'}
            value={Math.min(jobStatus.progress_percent, 100)}
          />
        </Paper>
      )}

      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {STEPS.map((label) => (<Step key={label}><StepLabel>{label}</StepLabel></Step>))}
      </Stepper>

      {infoMessage && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setInfoMessage(null)}>
          {infoMessage}
        </Alert>
      )}

      {error && step !== 'FAILED' && step !== 'CORRUPTED_STAGING' && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
          {runId && (jobStatus?.status === 'FAILED' || jobStatus?.status === 'CORRUPTED_STAGING' || preview?.status === 'CORRUPTED_STAGING') && (
            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button size="small" variant="contained" onClick={handleReanalyze} disabled={loading || polling}>
                Reanalisar arquivo
              </Button>
              {jobStatus?.status !== 'CORRUPTED_STAGING' && preview?.status !== 'CORRUPTED_STAGING' && (
                <Button size="small" variant="outlined" onClick={handleRebuildPreview} disabled={loading || polling}>
                  Recalcular preview
                </Button>
              )}
            </Box>
          )}
        </Alert>
      )}

      {step === 'UPLOAD' && !isAnalyzeLoading && (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Button variant="outlined" component="label">
              Selecionar arquivo .xlsx
              <input hidden type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Button>
            {file && <Typography variant="body2" color="text.secondary">Arquivo: {file.name}</Typography>}
            <Button variant="contained" startIcon={loading || polling ? <CircularProgress size={18} color="inherit" /> : <UploadFileIcon />} onClick={handleAnalyze} disabled={loading || polling || !file}>
              Analisar arquivo
            </Button>
          </Stack>
        </Paper>
      )}

      {step === 'CORRUPTED_STAGING' && runId && (
        <CorruptedStagingPanel
          runId={runId}
          message={
            excelDiagnostic?.message
            || jobStatus?.error_message
            || jobStatus?.message
            || error
            || 'Foram detectados valores numéricos incompatíveis no staging. Use o diagnóstico para confirmar a origem do problema.'
          }
          onReanalyze={handleReanalyze}
          onNewUpload={resetFlow}
          onRefreshStatus={handleRefreshStatus}
          onDiagnose={handleDiagnoseExcel}
          refreshing={refreshingStatus}
          diagnosing={diagnosingExcel}
          diagnostic={excelDiagnostic}
          diagnosticError={excelDiagnosticError}
        />
      )}

      {isAnalyzeLoading && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Analisando arquivo Excel</Typography>
            <Typography variant="body2" color="text.secondary">
              {jobStatus?.message || 'Arquivo recebido. Processamento em background...'}
            </Typography>
            {jobStatus && (
              <>
                <Typography variant="body2" color="text.secondary">
                  Fase: {jobStatus.phase ?? '—'} | {jobStatus.progress_current} / {jobStatus.progress_total} ({jobStatus.progress_percent}%)
                </Typography>
                <LinearProgress
                  variant={jobStatus.progress_total > 0 ? 'determinate' : 'indeterminate'}
                  value={Math.min(jobStatus.progress_percent, 100)}
                />
              </>
            )}
          </Stack>
        </Paper>
      )}

      {isPreviewLoading && runId && (
        <PreviewLoadingPanel
          runId={runId}
          status={jobStatus?.status || step}
          phase={jobStatus?.phase}
          progressCurrent={jobStatus?.progress_current}
          progressTotal={jobStatus?.progress_total}
          progressPercent={jobStatus?.progress_percent}
          message={jobStatus?.message || 'Gerando preview da importação...'}
          onRefreshStatus={handleRefreshStatus}
          refreshing={refreshingStatus}
        />
      )}

      {!isPreviewLoading && step !== 'CORRUPTED_STAGING' && step === 'MAPPING' && runDetail && (
        <Stack spacing={2}>
          {(jobStatus?.unknown_columns?.length ?? 0) > 0 && (
            <Alert severity="warning">
              Colunas desconhecidas: {(jobStatus?.unknown_columns ?? []).join(', ')}. Mapeie antes de continuar.
            </Alert>
          )}
          <MappingTable runDetail={runDetail} mappingState={mappingState} unknownColumns={jobStatus?.unknown_columns ?? []} onUpdate={updateMapping} />
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button variant="outlined" startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />} onClick={handleSaveMapping} disabled={loading || polling || previewBusy}>
              Salvar mapeamento
            </Button>
            <Button variant="contained" onClick={handleGeneratePreview} disabled={previewBusy || loading}>
              {previewBusy ? 'Gerando preview...' : 'Gerar preview'}
            </Button>
            <Button variant="outlined" startIcon={<CancelIcon />} onClick={handleCancel}>Cancelar importação</Button>
          </Stack>
        </Stack>
      )}

      {step === 'PREVIEW_READY' && preview && (
        <Stack spacing={2}>
          {(preview.summary.row_error_rows ?? preview.summary.error_rows ?? 0) > 0 ? (
            <Alert severity="warning">
              Preview pronto com avisos. Existem {(preview.summary.row_error_rows ?? preview.summary.error_rows)} linha(s) com erro crítico —
              elas serão ignoradas. As {(preview.summary.valid_rows ?? 0).toLocaleString('pt-BR')} linha(s) válidas podem ser aplicadas normalmente.
            </Alert>
          ) : (
            <Alert severity="info">Preview pronto. Você pode aplicar as linhas válidas.</Alert>
          )}
          <PreviewSummaryCards preview={preview} />
          {(preview.coerced_value_samples?.length ?? 0) > 0 && (
            <CoercedValuesTable samples={preview.coerced_value_samples!} />
          )}
          {preview.numeric_parse_samples && Object.keys(preview.numeric_parse_samples).length > 0 && (
            <NumericParseSamples samples={preview.numeric_parse_samples} />
          )}
          {preview.summary.error_rows > 0 && (
            <Alert severity="warning">
              Linhas com erro crítico não serão gravadas no banco.
            </Alert>
          )}
          {preview.sample_diffs.length > 0 && <DiffsTable diffs={preview.sample_diffs} />}
          {errorsPage.total > 0 && <PaginatedErrorsTable runId={runId!} initial={errorsPage} />}
          {warningsPage.total > 0 && <PaginatedWarningsTable runId={runId!} initial={warningsPage} />}
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button variant="contained" color="success" startIcon={loading || polling ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />} onClick={handleApply} disabled={loading || polling || !canApply}>
              Aplicar linhas válidas
            </Button>
            {(preview.summary.row_error_rows ?? preview.summary.error_rows ?? 0) > 0 && (
              <Button variant="outlined" onClick={handleExportErrors} disabled={loading || polling}>
                Exportar erros
              </Button>
            )}
            <Button variant="outlined" onClick={handleReanalyze} disabled={loading || polling}>
              Reanalisar arquivo
            </Button>
            <Button variant="outlined" onClick={handleRebuildPreview} disabled={loading || polling || previewBusy}>
              Recalcular preview
            </Button>
            <Button
              variant="outlined"
              onClick={goBackToMapping}
              disabled={polling || previewBusy}
            >
              Voltar ao mapeamento
            </Button>
            <Button variant="outlined" startIcon={<CancelIcon />} onClick={handleCancel}>Cancelar</Button>
          </Stack>
        </Stack>
      )}

      {step === 'FAILED' && !isPreviewLoading && (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Alert severity="error">
              {error || jobStatus?.error_message || jobStatus?.message || 'Erro na importação.'}
            </Alert>
            {preview && (
              <>
                <PreviewSummaryCards preview={preview} />
                {preview.sample_diffs.length > 0 && <DiffsTable diffs={preview.sample_diffs} />}
              </>
            )}
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button variant="contained" onClick={handleReanalyze} disabled={loading || polling}>
                Reanalisar arquivo
              </Button>
              {preview?.status !== 'CORRUPTED_STAGING' && (
                <Button variant="outlined" onClick={handleRebuildPreview} disabled={loading || polling}>
                  Recalcular preview
                </Button>
              )}
              <Button
                variant="outlined"
                onClick={goBackToMapping}
                disabled={polling}
              >
                Voltar ao mapeamento
              </Button>
              <Button variant="outlined" onClick={resetFlow}>Nova importação</Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {step === 'APPLIED' && applyResult && (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Alert severity="success">Importação aplicada com sucesso.</Alert>
            <Typography>Inseridas: {applyResult.inserted_rows ?? 0}</Typography>
            <Typography>Atualizadas: {applyResult.updated_rows ?? 0}</Typography>
            <Button variant="contained" onClick={resetFlow}>Nova importação</Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}

function MappingTable({ runDetail, mappingState, unknownColumns, onUpdate }: {
  runDetail: ImportRunDetail;
  mappingState: MappingState;
  unknownColumns: string[];
  onUpdate: (col: string, field: 'action' | 'target_column_name', value: string) => void;
}) {
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Coluna no Excel</TableCell>
            <TableCell>Ação</TableCell>
            <TableCell>Coluna destino</TableCell>
            <TableCell>Confiança</TableCell>
            <TableCell>Amostra</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {runDetail.column_mappings.map((row: ColumnMappingRow) => {
            const state = mappingState[row.excel_column_name];
            const isUnknown = unknownColumns.includes(row.excel_column_name) || row.confidence !== null && row.confidence < 1;
            return (
              <TableRow key={row.excel_column_name}>
                <TableCell>{row.excel_column_name}{isUnknown && <Chip label="revisar" color="warning" size="small" sx={{ ml: 1 }} />}</TableCell>
                <TableCell>
                  <TextField select size="small" value={state?.action ?? 'IGNORE'} onChange={(e) => onUpdate(row.excel_column_name, 'action', e.target.value)}>
                    <MenuItem value="MAP_TO_EXISTING">MAP_TO_EXISTING</MenuItem>
                    <MenuItem value="IGNORE">IGNORE</MenuItem>
                  </TextField>
                </TableCell>
                <TableCell>
                  <TextField select size="small" fullWidth disabled={state?.action !== 'MAP_TO_EXISTING'} value={state?.target_column_name ?? ''} onChange={(e) => onUpdate(row.excel_column_name, 'target_column_name', e.target.value)}>
                    <MenuItem value="">—</MenuItem>
                    {runDetail.target_columns.map((col) => <MenuItem key={col} value={col}>{col}</MenuItem>)}
                  </TextField>
                </TableCell>
                <TableCell>{state?.confidence ?? row.confidence ?? '—'}</TableCell>
                <TableCell>{(row.sample_values ?? []).join(', ') || '—'}</TableCell>
                <TableCell><Chip size="small" label={state?.action === 'MAP_TO_EXISTING' ? 'mapeada' : 'ignorada'} color={state?.action === 'MAP_TO_EXISTING' ? 'success' : 'default'} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function PreviewSummaryCards({ preview }: { preview: PreviewResult }) {
  const validRows = preview.summary.valid_rows
    ?? (preview.summary.insert_rows + preview.summary.update_rows + preview.summary.unchanged_rows);
  const rowErrors = preview.summary.row_error_rows ?? preview.summary.error_rows;
  const items = [
    ['Total', preview.summary.total_rows],
    ['Linhas válidas', validRows],
    ['Linhas com erro', rowErrors],
    ['Inserções', preview.summary.insert_rows],
    ['Atualizações', preview.summary.update_rows],
    ['Sem alteração', preview.summary.unchanged_rows],
    ['Warnings', preview.summary.warning_rows ?? 0],
    ['Normalizados', preview.summary.coerced_values ?? preview.coerced_value_samples?.length ?? 0],
    ['Mapeadas', preview.columns.mapped_count],
    ['Ignoradas', preview.columns.ignored_count],
  ];
  return (
    <Grid container spacing={2}>
      {items.map(([title, value]) => (
        <Grid item xs={6} sm={4} md={3} key={title}>
          <Card><CardContent><Typography variant="caption" color="text.secondary">{title}</Typography><Typography variant="h5">{value}</Typography></CardContent></Card>
        </Grid>
      ))}
    </Grid>
  );
}

function CoercedValuesTable({ samples }: { samples: NonNullable<PreviewResult['coerced_value_samples']> }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Valores normalizados automaticamente</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Linha</TableCell>
            <TableCell>Coluna</TableCell>
            <TableCell>Valor original</TableCell>
            <TableCell>Valor convertido</TableCell>
            <TableCell>Método</TableCell>
            <TableCell>Aviso</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {samples.map((row, i) => (
            <TableRow key={i}>
              <TableCell>{row.excel_row_number}</TableCell>
              <TableCell>{row.column_name}</TableCell>
              <TableCell>{row.raw_value ?? '—'}</TableCell>
              <TableCell>{row.parsed_value ?? '—'}</TableCell>
              <TableCell>{row.coercion_method ?? '—'}</TableCell>
              <TableCell>
                {row.scale_divisor
                  ? `dividido por ${row.scale_divisor}`
                  : (row.warning_message ?? '—')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

function NumericParseSamples({ samples }: { samples: NonNullable<PreviewResult['numeric_parse_samples']> }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Conversão numérica (amostra)</Typography>
      {Object.entries(samples).map(([column, rows]) => (
        <Box key={column} sx={{ mb: 2 }}>
          <Typography variant="subtitle2">{column}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Linha</TableCell>
                <TableCell>Valor Excel</TableCell>
                <TableCell>Convertido</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{row.excel_row_number ?? '—'}</TableCell>
                  <TableCell>{row.raw ?? '—'}</TableCell>
                  <TableCell>{row.parsed ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ))}
    </Paper>
  );
}

function DiffsTable({ diffs }: { diffs: PreviewResult['sample_diffs'] }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Prévia de alterações (amostra)</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Linha</TableCell>
            <TableCell>ID</TableCell>
            <TableCell>Coluna</TableCell>
            <TableCell>Excel</TableCell>
            <TableCell>Convertido</TableCell>
            <TableCell>Antigo</TableCell>
            <TableCell>Novo</TableCell>
            <TableCell>Tipo</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {diffs.map((d, i) => (
            <TableRow key={i}>
              <TableCell>{d.excel_row_number}</TableCell>
              <TableCell>{d.target_id ?? '—'}</TableCell>
              <TableCell>{d.column_name}</TableCell>
              <TableCell>{d.raw_value ?? '—'}</TableCell>
              <TableCell>{d.parsed_value ?? '—'}</TableCell>
              <TableCell>{d.old_value ?? '—'}</TableCell>
              <TableCell>{d.new_value ?? '—'}</TableCell>
              <TableCell>{d.diff_type}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

function PaginatedErrorsTable({ runId, initial }: { runId: number; initial: { page: number; rows: PreviewError[]; total: number } }) {
  const [page, setPage] = useState(initial.page);
  const [rows, setRows] = useState(initial.rows);
  const [total, setTotal] = useState(initial.total);
  const load = async (p: number) => {
    const data = await getImportErrors(runId, p + 1, 100);
    setRows(data.items);
    setTotal(data.total);
    setPage(p);
  };
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Linhas com erro crítico ({total})</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Linha</TableCell>
            <TableCell>Coluna</TableCell>
            <TableCell>Valor Excel</TableCell>
            <TableCell>Erro</TableCell>
            <TableCell>Ação</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((e, i) => (
            <TableRow key={i}>
              <TableCell>{e.excel_row_number}</TableCell>
              <TableCell>{e.column_name}</TableCell>
              <TableCell>{e.value ?? '—'}</TableCell>
              <TableCell>{e.error_message}</TableCell>
              <TableCell>Linha será ignorada</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => load(p)} rowsPerPage={100} rowsPerPageOptions={[100]} />
    </Paper>
  );
}

function PaginatedWarningsTable({ runId, initial }: { runId: number; initial: { page: number; rows: PreviewWarning[]; total: number } }) {
  const [page, setPage] = useState(initial.page);
  const [rows, setRows] = useState(initial.rows);
  const [total, setTotal] = useState(initial.total);

  useEffect(() => {
    setPage(initial.page);
    setRows(initial.rows);
    setTotal(initial.total);
  }, [initial.page, initial.rows, initial.total]);

  const load = async (p: number) => {
    const data = await getImportWarnings(runId, p + 1, 100);
    setRows(data.items);
    setTotal(data.total);
    setPage(p);
  };
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Warnings ({total})</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Linha</TableCell>
            <TableCell>Coluna</TableCell>
            <TableCell>Valor original</TableCell>
            <TableCell>Valor convertido</TableCell>
            <TableCell>Mensagem</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((w, i) => (
            <TableRow key={i}>
              <TableCell>{w.excel_row_number}</TableCell>
              <TableCell>{w.column_name || '—'}</TableCell>
              <TableCell>{w.raw_value ?? '—'}</TableCell>
              <TableCell>{w.parsed_value ?? '—'}</TableCell>
              <TableCell>{w.warning_message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => load(p)} rowsPerPage={100} rowsPerPageOptions={[100]} />
    </Paper>
  );
}
