import { Box, Card, CardActionArea, CardContent, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { stepTokens } from '../../theme/tokens';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  accent?: 'primary' | 'secondary' | 'neutral';
  hint?: string;
  to?: string;
  onClick?: () => void;
}

export default function KpiCard({ title, value, subtitle, icon, accent = 'primary', hint, to, onClick }: KpiCardProps) {
  const navigate = useNavigate();
  const clickable = Boolean(to || onClick);
  const accentColor =
    accent === 'secondary' ? stepTokens.secondary : accent === 'neutral' ? stepTokens.neutral700 : stepTokens.primary;

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (to) navigate(to);
  };

  const content = (
    <CardContent sx={{ height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {icon && (
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                color: accentColor,
                backgroundColor: `${accentColor}14`,
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700, color: stepTokens.neutral900 }}>
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {subtitle}
        </Typography>
      )}
      {hint && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: accentColor, fontWeight: 600 }}>
          {hint}
        </Typography>
      )}
      {clickable && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5, color: accentColor }}>
          <Typography variant="caption" fontWeight={600}>
            Ver detalhes
          </Typography>
          <ArrowForwardIcon sx={{ fontSize: 14 }} />
        </Box>
      )}
    </CardContent>
  );

  return (
    <Card
      sx={{
        height: '100%',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        ...(clickable && {
          '&:hover': {
            boxShadow: 3,
            transform: 'translateY(-2px)',
          },
        }),
      }}
    >
      {clickable ? (
        <CardActionArea onClick={handleClick} sx={{ height: '100%', cursor: 'pointer' }}>
          {content}
        </CardActionArea>
      ) : (
        content
      )}
    </Card>
  );
}
