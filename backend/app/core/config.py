import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

def get_env_file():
    """Determine which .env file to load based on APP_ENV variable."""
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    app_env = os.getenv("APP_ENV", "dev")  # Default to dev
    
    env_file = os.path.join(base_dir, f".env.{app_env}")
    
    # Fallback to .env if environment-specific file doesn't exist
    if not os.path.exists(env_file):
        env_file = os.path.join(base_dir, ".env")
    
    return env_file

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int

    # AI API Keys - provider is auto-detected based on which key is set
    OPENAI_API_KEY: Optional[str] = None
    GENAI_API_KEY: Optional[str] = None

    # Optional: Custom OpenAI model names for each complexity level
    OPENAI_MODEL_LOW: str = "gpt-3.5-turbo"
    OPENAI_MODEL_MEDIUM: str = "gpt-4"
    OPENAI_MODEL_HIGH: str = "gpt-4-turbo"
    
    # Embedding model configuration
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-large"
    GENAI_EMBEDDING_MODEL: str = "models/gemini-embedding-001"
    EMBEDDING_DIMENSIONS: int = 1024

    # Admin emails (comma-separated list) - these users can grant approver role
    ADMIN_EMAILS: str = ""
    
    @property
    def admin_email_list(self) -> List[str]:
        """Parse comma-separated admin emails into a list"""
        if not self.ADMIN_EMAILS:
            return []
        return [email.strip().lower() for email in self.ADMIN_EMAILS.split(",") if email.strip()]
    
    def is_admin_email(self, email: str) -> bool:
        """Check if an email is in the admin list"""
        return email.lower() in self.admin_email_list

    model_config = SettingsConfigDict(
        env_file=get_env_file(),
        extra="ignore"
    )

settings = Settings()
