from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    app_session_secret: str
    whatsapp_verify_token: str = ""
    whatsapp_app_secret: str = ""
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""
    frontend_origin: str = "http://localhost:5173"
    tesseract_cmd: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
