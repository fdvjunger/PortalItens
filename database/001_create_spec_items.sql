CREATE TABLE IF NOT EXISTS spec_items (
    id bigint PRIMARY KEY,
    cliente text NULL,

    spec_id bigint NULL,
    source_page integer NULL,
    item_type text NULL,
    short_code text NULL,
    nps numeric(18,6) NULL,
    schedule text NULL,
    geometric_standard text NULL,
    eds_vds text NULL,
    end_conn_1 text NULL,
    end_conn_2 text NULL,
    material_description text NULL,
    mds text NULL,
    rating text NULL,
    notes text NULL,
    nps_polegadas text NULL,
    item_key text NULL,
    sort_order integer NULL,
    is_active boolean NULL,

    created_at timestamptz NULL,
    updated_at timestamptz NULL,

    weight numeric(18,6) NULL,
    weight_unit text NULL,
    dn_mm numeric(18,6) NULL,
    od_mm numeric(18,6) NULL,
    wall_thk_mm numeric(18,6) NULL,
    id_mm numeric(18,6) NULL,

    nps_table_col_index integer NULL,
    nps_raw text NULL,
    nps_row_raw_cells_json text NULL,
    nps_table text NULL,
    half_od_mm numeric(18,6) NULL,

    weight_basis text NULL,
    weight_source_file text NULL,
    weight_source_sheet text NULL,
    weight_source_row integer NULL,
    weight_match_method text NULL,
    weight_match_confidence numeric(18,6) NULL,

    "alterDataID" text NULL,
    has_nace boolean NULL,

    dm_ex numeric(18,6) NULL,
    area_m2_per_m numeric(18,6) NULL,
    sch_mm numeric(18,6) NULL,
    radius numeric(18,6) NULL
);

CREATE INDEX IF NOT EXISTS idx_spec_items_cliente
ON spec_items(cliente);

CREATE INDEX IF NOT EXISTS idx_spec_items_spec_id
ON spec_items(spec_id);

CREATE INDEX IF NOT EXISTS idx_spec_items_item_type
ON spec_items(item_type);

CREATE INDEX IF NOT EXISTS idx_spec_items_short_code
ON spec_items(short_code);

CREATE INDEX IF NOT EXISTS idx_spec_items_schedule
ON spec_items(schedule);

CREATE INDEX IF NOT EXISTS idx_spec_items_material_description
ON spec_items(material_description);

CREATE INDEX IF NOT EXISTS idx_spec_items_mds
ON spec_items(mds);

CREATE INDEX IF NOT EXISTS idx_spec_items_alterdataid
ON spec_items("alterDataID");
