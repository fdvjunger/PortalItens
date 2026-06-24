from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    app_env: str = "local"
    cors_origins: str = "http://localhost:5173"
    log_level: str = "INFO"
    db_dialect: str | None = None
    db_schema: str | None = None
    spec_items_read_source: str | None = None
    use_catalog_writes: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
