ALTER TABLE app_import_diffs ADD COLUMN IF NOT EXISTS coercion_method text NULL;
ALTER TABLE app_import_diffs ADD COLUMN IF NOT EXISTS scale_divisor numeric(30, 12) NULL;
