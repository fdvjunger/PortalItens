-- Referência do modelo normalizado specDB (SQL Server).
-- A view dbo.v_spec_items_portal e dbo.spec_items já existem no banco alvo.
-- Este script documenta as tabelas físicas esperadas pelo backend.

IF OBJECT_ID('dbo.catalog_item_types', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.catalog_item_types (
        item_type_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        item_type_code NVARCHAR(200) NOT NULL,
        CONSTRAINT UQ_catalog_item_types_code UNIQUE (item_type_code)
    );
END;
GO

IF OBJECT_ID('dbo.catalog_nps_sizes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.catalog_nps_sizes (
        nps_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        nps_inches DECIMAL(18,6) NOT NULL,
        CONSTRAINT UQ_catalog_nps_sizes_inches UNIQUE (nps_inches)
    );
END;
GO

IF OBJECT_ID('dbo.catalog_schedules', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.catalog_schedules (
        schedule_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        schedule_code NVARCHAR(100) NOT NULL,
        CONSTRAINT UQ_catalog_schedules_code UNIQUE (schedule_code)
    );
END;
GO

IF OBJECT_ID('dbo.catalog_materials', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.catalog_materials (
        material_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        material_description NVARCHAR(500) NOT NULL,
        CONSTRAINT UQ_catalog_materials_description UNIQUE (material_description)
    );
END;
GO

IF OBJECT_ID('dbo.catalog_end_connections', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.catalog_end_connections (
        end_connection_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        connection_code NVARCHAR(200) NOT NULL,
        CONSTRAINT UQ_catalog_end_connections_code UNIQUE (connection_code)
    );
END;
GO

IF OBJECT_ID('dbo.catalog_ratings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.catalog_ratings (
        rating_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        rating_code NVARCHAR(100) NOT NULL,
        CONSTRAINT UQ_catalog_ratings_code UNIQUE (rating_code)
    );
END;
GO

IF OBJECT_ID('dbo.catalog_mds_codes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.catalog_mds_codes (
        mds_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        mds_code NVARCHAR(100) NOT NULL,
        CONSTRAINT UQ_catalog_mds_codes_code UNIQUE (mds_code)
    );
END;
GO

IF OBJECT_ID('dbo.catalog_seam_types', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.catalog_seam_types (
        seam_type_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        seam_type_code NVARCHAR(100) NOT NULL,
        CONSTRAINT UQ_catalog_seam_types_code UNIQUE (seam_type_code)
    );
END;
GO

IF OBJECT_ID('dbo.catalog_geometric_standards', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.catalog_geometric_standards (
        geometric_standard_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        geometric_standard_code NVARCHAR(200) NOT NULL,
        CONSTRAINT UQ_catalog_geometric_standards_code UNIQUE (geometric_standard_code)
    );
END;
GO

IF OBJECT_ID('dbo.catalog_clients', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.catalog_clients (
        client_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        client_code NVARCHAR(200) NOT NULL,
        CONSTRAINT UQ_catalog_clients_code UNIQUE (client_code)
    );
END;
GO

IF OBJECT_ID('dbo.catalog_items', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.catalog_items (
        catalog_item_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        canonical_item_key NVARCHAR(2000) NOT NULL,
        item_type_id INT NOT NULL,
        nps_id INT NULL,
        schedule_id INT NULL,
        material_id INT NULL,
        end_conn_1_id INT NULL,
        end_conn_2_id INT NULL,
        mds_id INT NULL,
        rating_id INT NULL,
        seam_type_id INT NULL,
        geometric_standard_id INT NULL,
        has_nace BIT NULL,
        dn_mm DECIMAL(18,6) NULL,
        od_mm DECIMAL(18,6) NULL,
        wall_thk_mm DECIMAL(18,6) NULL,
        id_mm DECIMAL(18,6) NULL,
        weight DECIMAL(18,6) NULL,
        weight_unit NVARCHAR(50) NULL,
        weight_basis NVARCHAR(100) NULL,
        dm_ex DECIMAL(18,6) NULL,
        area_m2_per_m DECIMAL(18,6) NULL,
        sch_mm DECIMAL(18,6) NULL,
        radius DECIMAL(18,6) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NULL,
        CONSTRAINT UQ_catalog_items_canonical_key UNIQUE (canonical_item_key)
    );
END;
GO

IF OBJECT_ID('dbo.spec_catalog_items', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.spec_catalog_items (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        spec_id BIGINT NOT NULL,
        catalog_item_id INT NOT NULL,
        source_page INT NULL,
        eds_vds NVARCHAR(200) NULL,
        notes NVARCHAR(MAX) NULL,
        nps_polegadas NVARCHAR(100) NULL,
        item_key NVARCHAR(500) NULL,
        sort_order INT NULL,
        is_active BIT NOT NULL DEFAULT 1,
        nps_table_col_index INT NULL,
        nps_raw NVARCHAR(200) NULL,
        nps_row_raw_cells_json NVARCHAR(MAX) NULL,
        nps_table NVARCHAR(200) NULL,
        half_od_mm DECIMAL(18,6) NULL,
        weight_source_file NVARCHAR(500) NULL,
        weight_source_sheet NVARCHAR(200) NULL,
        weight_source_row INT NULL,
        weight_match_method NVARCHAR(100) NULL,
        weight_match_confidence DECIMAL(18,6) NULL,
        alterDataID NVARCHAR(100) NULL,
        legacy_r DECIMAL(18,6) NULL,
        client_id INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NULL
    );
END;
GO

IF OBJECT_ID('dbo.catalog_item_alterdata_ids', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.catalog_item_alterdata_ids (
        catalog_item_id INT NOT NULL,
        alterdata_id NVARCHAR(100) NOT NULL,
        CONSTRAINT PK_catalog_item_alterdata_ids PRIMARY KEY (catalog_item_id, alterdata_id)
    );
END;
GO
