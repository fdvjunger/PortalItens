import {
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
} from '@mui/material';
import { ColumnMetadata } from '../api/specItemsApi';

interface ColumnSelectorProps {
  columns: ColumnMetadata[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function ColumnSelector({ columns, selected, onChange }: ColumnSelectorProps) {
  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    onChange(typeof value === 'string' ? value.split(',') : value);
  };

  return (
    <FormControl fullWidth>
      <InputLabel>Colunas visíveis</InputLabel>
      <Select
        multiple
        value={selected}
        onChange={handleChange}
        input={<OutlinedInput label="Colunas visíveis" />}
        renderValue={(selectedValues) => selectedValues.join(', ')}
      >
        {columns.map((column) => (
          <MenuItem key={column.column_name} value={column.column_name}>
            <Checkbox checked={selected.includes(column.column_name)} />
            <ListItemText primary={column.column_name} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
