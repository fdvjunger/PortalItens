ALTER TABLE app_import_diffs
ADD COLUMN IF NOT EXISTS raw_value text NULL;

ALTER TABLE app_import_diffs
ADD COLUMN IF NOT EXISTS parsed_value text NULL;

ALTER TABLE app_import_diffs
ADD COLUMN IF NOT EXISTS coercion_method text NULL;

ALTER TABLE app_import_diffs
ADD COLUMN IF NOT EXISTS scale_divisor numeric(30, 12) NULL;

ALTER TABLE app_import_diffs
ADD COLUMN IF NOT EXISTS repair_applied boolean NOT NULL DEFAULT false;

ALTER TABLE app_import_diffs
ADD COLUMN IF NOT EXISTS repair_divisor numeric(30, 12) NULL;
