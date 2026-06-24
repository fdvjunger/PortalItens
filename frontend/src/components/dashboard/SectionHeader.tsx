import { Box, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { stepTokens } from '../../theme/tokens';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  badge?: ReactNode;
}

export default function SectionHeader({ title, subtitle, action, badge }: SectionHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        gap: 2,
        mb: 2,
        flexWrap: 'wrap',
      }}
    >
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: subtitle ? 0.5 : 0 }}>
          <Typography variant="h6" color="text.primary">
            {title}
          </Typography>
          {badge}
        </Box>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
      <Box sx={{ display: { xs: 'none', md: 'block' }, width: 48, height: 3, borderRadius: 2, background: stepTokens.gradient, ml: 'auto' }} />
    </Box>
  );
}
