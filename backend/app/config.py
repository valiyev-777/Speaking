from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    # Application
    app_name: str = "IELTS Speaking Partner"
    debug: bool = False
    
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ielts_speaking"
    
    @field_validator('database_url', mode='before')
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        """Convert Render's postgres:// to postgresql+asyncpg://"""
        if v and v.startswith('postgres://'):
            return v.replace('postgres://', 'postgresql+asyncpg://', 1)
        if v and v.startswith('postgresql://'):
            return v.replace('postgresql://', 'postgresql+asyncpg://', 1)
        return v
    
    # JWT
    secret_key: str = "your-super-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    
    # Matchmaking
    roulette_interval_seconds: int = 20
    session_min_duration_minutes: int = 5
    session_max_duration_minutes: int = 15
    
    # CORS (comma-separated string or list)
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        if isinstance(self.cors_origins, list):
            return self.cors_origins
        return [origin.strip() for origin in self.cors_origins.split(',') if origin.strip()]
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
