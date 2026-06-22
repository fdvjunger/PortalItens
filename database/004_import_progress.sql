ALTER TABLE app_import_runs ADD COLUMN IF NOT EXISTS phase text NULL;
ALTER TABLE app_import_runs ADD COLUMN IF NOT EXISTS progress_current integer NOT NULL DEFAULT 0;
ALTER TABLE app_import_runs ADD COLUMN IF NOT EXISTS progress_total integer NOT NULL DEFAULT 0;
ALTER TABLE app_import_runs ADD COLUMN IF NOT EXISTS progress_percent numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE app_import_runs ADD COLUMN IF NOT EXISTS progress_message text NULL;
ALTER TABLE app_import_runs ADD COLUMN IF NOT EXISTS started_at timestamptz NULL;
ALTER TABLE app_import_runs ADD COLUMN IF NOT EXISTS finished_at timestamptz NULL;
ALTER TABLE app_import_runs ADD COLUMN IF NOT EXISTS source_file_path text NULL;
