ALTER TABLE app_import_diffs ADD COLUMN IF NOT EXISTS raw_value text NULL;
ALTER TABLE app_import_diffs ADD COLUMN IF NOT EXISTS parsed_value text NULL;
