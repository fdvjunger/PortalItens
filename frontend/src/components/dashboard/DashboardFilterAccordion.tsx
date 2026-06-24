import {
  Box,
  Button,
  Collapse,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useState } from 'react';
import { FILTER_LABELS, SpecItemsFilterValues, emptySpecItemsFilters } from '../../types/filters';

interface DashboardFilterAccordionProps {
  values: SpecItemsFilterValues;
  onChange: (field: keyof SpecItemsFilterValues, value: string) => void;
  onApply: () => void;
  onClear: () => void;
  includeExternalItems: boolean;
  onIncludeExternalItemsChange: (value: boolean) => void;
}

const triStateOptions = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Sim' },
  { value: 'false', label: 'Não' },
];

export default function DashboardFilterAccordion({
  values,
  onChange,
  onApply,
  onClear,
  includeExternalItems,
  onIncludeExternalItemsChange,
}: DashboardFilterAccordionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box sx={{ borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', overflow: 'hidden' }}>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={() => setExpanded((v) => !v)}
        role="button"
        aria-expanded={expanded}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterAltIcon fontSize="small" color="action" />
          <Typography variant="subtitle1" fontWeight={700}>
            Filtros
          </Typography>
        </Box>
        <IconButton size="small" aria-label={expanded ? 'Recolher filtros' : 'Expandir filtros'}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <TextField
                fullWidth
                size="small"
                label={FILTER_LABELS.cliente}
                value={values.cliente}
                onChange={(e) => onChange('cliente', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <TextField
                fullWidth
                size="small"
                label={FILTER_LABELS.spec_id}
                value={values.spec_id}
                onChange={(e) => onChange('spec_id', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <TextField
                fullWidth
                size="small"
                label={FILTER_LABELS.item_type}
                value={values.item_type}
                onChange={(e) => onChange('item_type', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <TextField
                fullWidth
                size="small"
                label={FILTER_LABELS.material_description}
                value={values.material_description}
                onChange={(e) => onChange('material_description', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <TextField
                fullWidth
                size="small"
                label={FILTER_LABELS.mds}
                value={values.mds}
                onChange={(e) => onChange('mds', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <TextField
                fullWidth
                size="small"
                label={FILTER_LABELS.rating}
                value={values.rating}
                onChange={(e) => onChange('rating', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <TextField
                fullWidth
                size="small"
                label={FILTER_LABELS.schedule}
                value={values.schedule}
                onChange={(e) => onChange('schedule', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <TextField
                fullWidth
                size="small"
                select
                label={FILTER_LABELS.has_nace}
                value={values.has_nace}
                onChange={(e) => onChange('has_nace', e.target.value)}
              >
                {triStateOptions.map((opt) => (
                  <MenuItem key={opt.value || 'all-nace'} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {(['has_weight', 'has_alterdata', 'has_paint_area', 'has_material'] as const).map((field) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={field}>
                <TextField
                  fullWidth
                  size="small"
                  select
                  label={FILTER_LABELS[field]}
                  value={values[field]}
                  onChange={(e) => onChange(field, e.target.value)}
                >
                  {triStateOptions.map((opt) => (
                    <MenuItem key={`${field}-${opt.value || 'all'}`} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            ))}
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label={FILTER_LABELS.global_search}
                value={values.global_search}
                onChange={(e) => onChange('global_search', e.target.value)}
              />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant="contained" size="small" onClick={onApply}>
              Aplicar filtros
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
        </Box>
      </Collapse>
    </Box>
  );
}

export { emptySpecItemsFilters };
