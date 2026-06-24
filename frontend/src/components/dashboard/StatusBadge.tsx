import { Chip } from '@mui/material';
import { QualitySeverity, qualityColor } from '../../theme/tokens';

interface StatusBadgeProps {
  label: string;
  severity?: QualitySeverity;
}

export default function StatusBadge({ label, severity = 'good' }: StatusBadgeProps) {
  const color = qualityColor(severity);
  return (
    <Chip
      size="small"
      label={label}
      sx={{
        bgcolor: `${color}18`,
        color,
        fontWeight: 600,
        border: `1px solid ${color}33`,
      }}
    />
  );
}
