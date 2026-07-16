"""Pydantic response models — MongoDB `_id` is always excluded upstream."""
from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, EmailStr, Field


# ---- Users ----
class UserPublic(BaseModel):
    user_id: str
    email: EmailStr
    name: str
    picture: Optional[str] = None
    provider: Literal["email", "google"]
    language: str = "en"
    theme: Literal["dark", "amoled", "light"] = "dark"
    created_at: datetime
    onboarding_completed: bool = False


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionRequest(BaseModel):
    session_token: str


class AuthResponse(BaseModel):
    token: str
    token_type: Literal["jwt", "session"]
    user: UserPublic


# ---- Profile ----
class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=80)
    language: Optional[str] = None
    picture: Optional[str] = None
    onboarding_completed: Optional[bool] = None


# ---- Settings ----
class SettingsModel(BaseModel):
    user_id: str
    theme: Literal["dark", "amoled", "light"] = "dark"
    language: str = "en"
    voice_wake_word_enabled: bool = False
    voice_output_enabled: bool = True
    voice_speed: float = 1.0
    voice_gender: Literal["female", "male", "neutral"] = "female"
    haptics_enabled: bool = True
    notifications_enabled: bool = True
    memory_enabled: bool = True
    history_enabled: bool = True
    ai_provider: Literal["ollama", "llama_cpp", "vllm", "lm_studio", "openrouter"] = "ollama"
    ai_provider_base_url: Optional[str] = None
    ai_provider_model: Optional[str] = None
    updated_at: datetime


class SettingsUpdate(BaseModel):
    theme: Optional[Literal["dark", "amoled", "light"]] = None
    language: Optional[str] = None
    voice_wake_word_enabled: Optional[bool] = None
    voice_output_enabled: Optional[bool] = None
    voice_speed: Optional[float] = Field(default=None, ge=0.5, le=2.0)
    voice_gender: Optional[Literal["female", "male", "neutral"]] = None
    haptics_enabled: Optional[bool] = None
    notifications_enabled: Optional[bool] = None
    memory_enabled: Optional[bool] = None
    history_enabled: Optional[bool] = None
    ai_provider: Optional[Literal["ollama", "llama_cpp", "vllm", "lm_studio", "openrouter"]] = None
    ai_provider_base_url: Optional[str] = None
    ai_provider_model: Optional[str] = None


# ---- Memories ----
class MemoryCreate(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    content: str = Field(min_length=1, max_length=4000)
    tags: list[str] = Field(default_factory=list)


class MemoryUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[list[str]] = None


class Memory(BaseModel):
    memory_id: str
    user_id: str
    title: str
    content: str
    tags: list[str]
    created_at: datetime
    updated_at: datetime


# ---- Reminders ----
class ReminderCreate(BaseModel):
    title: str
    notes: Optional[str] = None
    remind_at: datetime


class Reminder(BaseModel):
    reminder_id: str
    user_id: str
    title: str
    notes: Optional[str] = None
    remind_at: datetime
    completed: bool = False
    created_at: datetime


# ---- Tasks ----
class TaskCreate(BaseModel):
    title: str
    notes: Optional[str] = None
    due_at: Optional[datetime] = None
    priority: Literal["low", "medium", "high"] = "medium"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    due_at: Optional[datetime] = None
    priority: Optional[Literal["low", "medium", "high"]] = None
    completed: Optional[bool] = None


class Task(BaseModel):
    task_id: str
    user_id: str
    title: str
    notes: Optional[str] = None
    due_at: Optional[datetime] = None
    priority: Literal["low", "medium", "high"] = "medium"
    completed: bool = False
    created_at: datetime
    updated_at: datetime


# ---- History ----
class HistoryCreate(BaseModel):
    title: str
    snippet: str
    turns: int = 1


class HistoryItem(BaseModel):
    history_id: str
    user_id: str
    title: str
    snippet: str
    turns: int
    created_at: datetime


# ---- AI Provider config (future-facing, model-agnostic) ----
class AIProviderInfo(BaseModel):
    id: Literal["ollama", "llama_cpp", "vllm", "lm_studio", "openrouter"]
    label: str
    default_base_url: str
    supports_streaming: bool
    example_models: list[str]
