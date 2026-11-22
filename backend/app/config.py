from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    NVIDIA_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = "JBFqnCBsd6RMkjVDRZzb"
    SWIGGY_CLIENT_ID: str = ""
    SWIGGY_CLIENT_SECRET: str = ""
    SWIGGY_MCP_INSTAMART_URL: str = "https://mcp.swiggy.com/im"
    SWIGGY_OAUTH_TOKEN_URL: str = "https://mcp.swiggy.com/oauth/token"
    SWIGGY_OAUTH_REDIRECT_URI: str = "http://localhost:8000/auth/callback"
    REDIS_URL: str = "redis://localhost:6379"
    DATABASE_URL: str = ""
    SECRET_KEY: str = "secret"
    LOG_LEVEL: str = "INFO"
    MOCK_MCP: bool = True
    RAPIDAPI_KEY: str = ""
    INSTALOADER_SESSION: str = ""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8-sig",
    )

settings = Settings()
