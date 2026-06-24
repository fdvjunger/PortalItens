import { Box, Button, Collapse, FormControlLabel, Grid, MenuItem, Switch, TextField, Typography } from '@mui/material';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useState } from 'react';
import { FILTER_LABELS, SpecItemsFilterValues, emptySpecItemsFilters } from '../../types/filters';
import { PRODUCTIVE_DASHBOARD_NOTE } from '../../utils/productiveDashboard';

interface DashboardFilterBarProps {
  values: SpecItemsFilterValues;
  onChange: (field: keyof SpecItemsFilterValues, value: string) => void;
  onClear: () => void;
  includeExternalItems: boolean;
  onIncludeExternalItemsChange: (value: boolean) => void;
}

const triStateOptions = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Sim' },
  { value: 'false', label: 'Não' },
];

export default function DashboardFilterBar({
  values,
  onChange,
  onClear,
  includeExternalItems,
  onIncludeExternalItemsChange,
}: DashboardFilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6} lg={4}>
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
          <TextField fullWidth size="small" label={FILTER_LABELS.spec_id} value={values.spec_id} onChange={(e) => onChange('spec_id', e.target.value)} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField fullWidth size="small" label={FILTER_LABELS.item_type} value={values.item_type} onChange={(e) => onChange('item_type', e.target.value)} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField fullWidth size="small" label={FILTER_LABELS.material_description} value={values.material_description} onChange={(e) => onChange('material_description', e.target.value)} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField fullWidth size="small" label={FILTER_LABELS.mds} value={values.mds} onChange={(e) => onChange('mds', e.target.value)} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField fullWidth size="small" label={FILTER_LABELS.schedule} value={values.schedule} onChange={(e) => onChange('schedule', e.target.value)} />
        </Grid>
      </Grid>

      <Collapse in={expanded}>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label={FILTER_LABELS.rating} value={values.rating} onChange={(e) => onChange('rating', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" select label={FILTER_LABELS.has_nace} value={values.has_nace} onChange={(e) => onChange('has_nace', e.target.value)}>
              {triStateOptions.map((opt) => (
                <MenuItem key={opt.value || 'all'} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>
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
        </Grid>
      </Collapse>

      <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button size="small" startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Menos filtros' : 'Mais filtros'}
        </Button>
        <Button size="small" startIcon={<FilterAltOffIcon />} onClick={onClear}>
          Limpar filtros
        </Button>
        <FormControlLabel
          sx={{ ml: { sm: 1 } }}
          control={
            <Switch
              size="small"
              checked={includeExternalItems}
              onChange={(e) => onIncludeExternalItemsChange(e.target.checked)}
            />
          }
          label="Incluir itens externos (válvulas, gaskets, fixadores)"
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        {PRODUCTIVE_DASHBOARD_NOTE}
      </Typography>
    </Box>
  );
}

export { emptySpecItemsFilters };
