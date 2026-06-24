export interface SpecItemsFilterValues {
  global_search: string;
  cliente: string;
  item_type: string;
  short_code: string;
  schedule: string;
  material_description: string;
  mds: string;
  spec_id: string;
  has_nace: string;
  rating: string;
  has_weight: string;
  has_alterdata: string;
  has_paint_area: string;
  has_material: string;
}

export const emptySpecItemsFilters: SpecItemsFilterValues = {
  global_search: '',
  cliente: '',
  item_type: '',
  short_code: '',
  schedule: '',
  material_description: '',
  mds: '',
  spec_id: '',
  has_nace: '',
  rating: '',
  has_weight: '',
  has_alterdata: '',
  has_paint_area: '',
  has_material: '',
};

export const FILTER_LABELS: Record<keyof SpecItemsFilterValues, string> = {
  global_search: 'Busca global',
  cliente: 'Cliente',
  item_type: 'Família / Item Type',
  short_code: 'Short code',
  schedule: 'Schedule',
  material_description: 'Material',
  mds: 'MDS',
  spec_id: 'Spec',
  has_nace: 'Has NACE',
  rating: 'Rating',
  has_weight: 'Com peso',
  has_alterdata: 'Com AlterDataID',
  has_paint_area: 'Com área de pintura',
  has_material: 'Com material',
};

export function filtersToQuery(filters: SpecItemsFilterValues): Record<string, string | undefined> {
  const query: Record<string, string | undefined> = {};
  (Object.keys(filters) as Array<keyof SpecItemsFilterValues>).forEach((key) => {
    const value = filters[key];
    if (value) query[key] = value;
  });
  return query;
}

export function countActiveFilters(filters: SpecItemsFilterValues): number {
  return (Object.keys(filters) as Array<keyof SpecItemsFilterValues>).filter((key) => Boolean(filters[key])).length;
}
