from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "event_platform"
    jwt_secret: str = "dev-only-change-me"
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:3000"
    cookie_secure: bool = False
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_base_url: str = "https://api.openai.com/v1"

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        # Dev convenience: allow common localhost aliases if not listed
        for extra in ("http://localhost:3000", "http://127.0.0.1:3000"):
            if extra not in origins:
                origins.append(extra)
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
