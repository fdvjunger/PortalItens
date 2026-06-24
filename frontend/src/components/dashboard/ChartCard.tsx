import { Box, Card, CardContent, Typography } from '@mui/material';
import { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: number;
}

export default function ChartCard({ title, subtitle, children, height = 320 }: ChartCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {subtitle}
          </Typography>
        )}
        <Box sx={{ width: '100%', height }}>{children}</Box>
      </CardContent>
    </Card>
  );
}
