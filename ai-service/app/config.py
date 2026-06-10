import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # OCR
    easyocr_languages: list[str] = ["en"]
    easyocr_gpu: bool = False
    confidence_threshold: float = 0.35

    # Upload limits
    max_file_size_mb: int = 10

    # CORS
    allowed_origins: list[str] = ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
