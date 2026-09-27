import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "SmartDoc AI Backend"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    
    # Database (PostgreSQL)
    DATABASE_URL: str = "postgresql://postgres:postgres@postgres:5432/smartdoc_db"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    
    # Cache (Redis)
    REDIS_URL: str = "redis://redis:6379/0"
    REDIS_CACHE_TTL_SECONDS: int = 3600
    
    # AI / LLM Configuration
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-3.5-turbo"
    MAX_TOKENS_PER_ANALYSIS: int = 1500
    
    # Upload storage directory
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "/tmp/smartdoc_uploads")
    
    # CORS
    CORS_ORIGINS: str = "*"

    @property
    def cors_origins_list(self) -> List[str]:
        if not self.CORS_ORIGINS or self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
