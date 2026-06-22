import { Grid, MenuItem, TextField } from '@mui/material';

export interface FilterValues {
  global_search: string;
  cliente: string;
  item_type: string;
  short_code: string;
  schedule: string;
  material_description: string;
  mds: string;
  spec_id: string;
  has_nace: string;
}

interface FilterBarProps {
  values: FilterValues;
  onChange: (field: keyof FilterValues, value: string) => void;
}

export default function FilterBar({ values, onChange }: FilterBarProps) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Pesquisa global"
          value={values.global_search}
          onChange={(e) => onChange('global_search', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          label="Cliente"
          value={values.cliente}
          onChange={(e) => onChange('cliente', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          label="Tipo de item"
          value={values.item_type}
          onChange={(e) => onChange('item_type', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          label="Short code"
          value={values.short_code}
          onChange={(e) => onChange('short_code', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          label="Schedule"
          value={values.schedule}
          onChange={(e) => onChange('schedule', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          label="Material"
          value={values.material_description}
          onChange={(e) => onChange('material_description', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          label="MDS"
          value={values.mds}
          onChange={(e) => onChange('mds', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          label="Spec ID"
          value={values.spec_id}
          onChange={(e) => onChange('spec_id', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          select
          label="Has NACE"
          value={values.has_nace}
          onChange={(e) => onChange('has_nace', e.target.value)}
        >
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="true">Sim</MenuItem>
          <MenuItem value="false">Não</MenuItem>
        </TextField>
      </Grid>
    </Grid>
  );
}
