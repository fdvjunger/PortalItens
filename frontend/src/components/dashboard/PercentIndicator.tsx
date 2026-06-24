import { Box, LinearProgress, Typography } from '@mui/material';
import { QualitySeverity, qualityColor, qualitySeverity } from '../../theme/tokens';

interface PercentIndicatorProps {
  value: number;
  label?: string;
  invertSeverity?: boolean;
}

export default function PercentIndicator({ value, label, invertSeverity = false }: PercentIndicatorProps) {
  const severity: QualitySeverity = invertSeverity
    ? qualitySeverity(100 - value)
    : qualitySeverity(value);
  const color = qualityColor(severity);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {label ?? `${value.toFixed(1)}%`}
        </Typography>
        <Typography variant="caption" fontWeight={700} sx={{ color }}>
          {value.toFixed(1)}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(value, 100)}
        sx={{
          height: 8,
          borderRadius: 99,
          bgcolor: `${color}18`,
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 99 },
        }}
      />
    </Box>
  );
}
