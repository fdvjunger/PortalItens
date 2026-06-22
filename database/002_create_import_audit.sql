CREATE TABLE IF NOT EXISTS app_import_runs (
    id bigserial PRIMARY KEY,
    file_name text NOT NULL,
    sheet_name text NULL,
    status text NOT NULL DEFAULT 'ANALYZED',
    total_rows integer NOT NULL DEFAULT 0,
    inserted_rows integer NOT NULL DEFAULT 0,
    updated_rows integer NOT NULL DEFAULT 0,
    unchanged_rows integer NOT NULL DEFAULT 0,
    ignored_rows integer NOT NULL DEFAULT 0,
    error_rows integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    applied_at timestamptz NULL,
    error_message text NULL
);

CREATE TABLE IF NOT EXISTS app_import_rows (
    id bigserial PRIMARY KEY,
    import_run_id bigint NOT NULL REFERENCES app_import_runs(id) ON DELETE CASCADE,
    excel_row_number integer NOT NULL,
    target_id bigint NULL,
    row_status text NOT NULL DEFAULT 'PENDING',
    raw_json jsonb NOT NULL,
    error_message text NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_import_column_mappings (
    id bigserial PRIMARY KEY,
    import_run_id bigint NOT NULL REFERENCES app_import_runs(id) ON DELETE CASCADE,
    excel_column_name text NOT NULL,
    target_column_name text NULL,
    action text NOT NULL DEFAULT 'IGNORE',
    confidence numeric(18,6) NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(import_run_id, excel_column_name)
);

CREATE TABLE IF NOT EXISTS app_import_diffs (
    id bigserial PRIMARY KEY,
    import_run_id bigint NOT NULL REFERENCES app_import_runs(id) ON DELETE CASCADE,
    import_row_id bigint NOT NULL REFERENCES app_import_rows(id) ON DELETE CASCADE,
    excel_row_number integer NOT NULL,
    target_id bigint NULL,
    column_name text NOT NULL,
    old_value text NULL,
    new_value text NULL,
    diff_type text NOT NULL,
    warning_message text NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_import_errors (
    id bigserial PRIMARY KEY,
    import_run_id bigint NOT NULL REFERENCES app_import_runs(id) ON DELETE CASCADE,
    import_row_id bigint NULL REFERENCES app_import_rows(id) ON DELETE CASCADE,
    excel_row_number integer NULL,
    column_name text NULL,
    value text NULL,
    error_message text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_import_apply_log (
    id bigserial PRIMARY KEY,
    import_run_id bigint NOT NULL REFERENCES app_import_runs(id) ON DELETE CASCADE,
    action_type text NOT NULL,
    target_id bigint NULL,
    column_name text NULL,
    old_value text NULL,
    new_value text NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
