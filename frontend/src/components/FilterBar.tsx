import { Grid, MenuItem, TextField } from '@mui/material';
import { FILTER_LABELS, SpecItemsFilterValues } from '../types/filters';

interface FilterBarProps {
  values: SpecItemsFilterValues;
  onChange: (field: keyof SpecItemsFilterValues, value: string) => void;
  compact?: boolean;
}

const triStateOptions = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Sim' },
  { value: 'false', label: 'Não' },
];

export default function FilterBar({ values, onChange, compact = false }: FilterBarProps) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          size="small"
          label={FILTER_LABELS.global_search}
          value={values.global_search}
          onChange={(e) => onChange('global_search', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField fullWidth size="small" label={FILTER_LABELS.cliente} value={values.cliente} onChange={(e) => onChange('cliente', e.target.value)} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField fullWidth size="small" label={FILTER_LABELS.item_type} value={values.item_type} onChange={(e) => onChange('item_type', e.target.value)} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField fullWidth size="small" label={FILTER_LABELS.short_code} value={values.short_code} onChange={(e) => onChange('short_code', e.target.value)} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField fullWidth size="small" label={FILTER_LABELS.schedule} value={values.schedule} onChange={(e) => onChange('schedule', e.target.value)} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField fullWidth size="small" label={FILTER_LABELS.material_description} value={values.material_description} onChange={(e) => onChange('material_description', e.target.value)} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField fullWidth size="small" label={FILTER_LABELS.mds} value={values.mds} onChange={(e) => onChange('mds', e.target.value)} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField fullWidth size="small" label={FILTER_LABELS.spec_id} value={values.spec_id} onChange={(e) => onChange('spec_id', e.target.value)} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField fullWidth size="small" select label={FILTER_LABELS.has_nace} value={values.has_nace} onChange={(e) => onChange('has_nace', e.target.value)}>
          {triStateOptions.map((opt) => (
            <MenuItem key={opt.value || 'all'} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>
      </Grid>
      {!compact && (
        <>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label={FILTER_LABELS.rating} value={values.rating} onChange={(e) => onChange('rating', e.target.value)} />
          </Grid>
          {(['has_weight', 'has_alterdata', 'has_paint_area', 'has_material'] as const).map((field) => (
            <Grid item xs={12} sm={6} md={3} key={field}>
              <TextField fullWidth size="small" select label={FILTER_LABELS[field]} value={values[field]} onChange={(e) => onChange(field, e.target.value)}>
                {triStateOptions.map((opt) => (
                  <MenuItem key={`${field}-${opt.value || 'all'}`} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
          ))}
        </>
      )}
    </Grid>
  );
}

export type { SpecItemsFilterValues as FilterValues };
