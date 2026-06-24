export const stepTokens = {
  primary: '#0B4F8C',
  primaryDark: '#083A66',
  primaryLight: '#1E6BB8',
  secondary: '#00A9CE',
  secondaryLight: '#4FD2EB',
  accent: '#00C2E0',
  success: '#2E7D32',
  warning: '#ED8F03',
  error: '#D32F2F',
  neutral50: '#F7F9FC',
  neutral100: '#EEF2F7',
  neutral200: '#DDE4EE',
  neutral500: '#6B7A90',
  neutral700: '#3D4A5C',
  neutral900: '#1A2433',
  background: '#F4F7FB',
  surface: '#FFFFFF',
  border: '#DDE4EE',
  gradient: 'linear-gradient(135deg, #083A66 0%, #0B4F8C 45%, #00A9CE 100%)',
} as const;

export type QualitySeverity = 'good' | 'attention' | 'warning' | 'critical';

export function qualitySeverity(percent: number): QualitySeverity {
  if (percent <= 10) return 'good';
  if (percent <= 25) return 'attention';
  if (percent <= 45) return 'warning';
  return 'critical';
}

export function qualityColor(severity: QualitySeverity): string {
  switch (severity) {
    case 'good':
      return stepTokens.success;
    case 'attention':
      return '#C9A227';
    case 'warning':
      return stepTokens.warning;
    case 'critical':
      return stepTokens.error;
    default:
      return stepTokens.neutral500;
  }
}
