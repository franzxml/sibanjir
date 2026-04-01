from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "sibanjir"
    app_env: str = "development"
    app_debug: bool = True
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    allowed_origins: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
