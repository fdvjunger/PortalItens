import { Box, Chip } from '@mui/material';
import { FILTER_LABELS, SpecItemsFilterValues } from '../../types/filters';

interface ActiveFilterChipsProps {
  values: SpecItemsFilterValues;
  onRemove: (field: keyof SpecItemsFilterValues) => void;
}

export default function ActiveFilterChips({ values, onRemove }: ActiveFilterChipsProps) {
  const active = (Object.keys(values) as Array<keyof SpecItemsFilterValues>).filter((key) => values[key]);

  if (!active.length) return null;

  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
      {active.map((field) => (
        <Chip
          key={field}
          size="small"
          color="primary"
          variant="outlined"
          label={`${FILTER_LABELS[field]}: ${values[field]}`}
          onDelete={() => onRemove(field)}
        />
      ))}
    </Box>
  );
}
