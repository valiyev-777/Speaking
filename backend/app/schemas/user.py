from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from uuid import UUID


class UserCreate(BaseModel):
    """Schema for user registration."""
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    username: str = Field(..., min_length=2, max_length=100)
    current_level: float = Field(default=6.0, ge=1.0, le=9.0)
    target_score: float = Field(default=7.0, ge=1.0, le=9.0)


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema for user response."""
    id: UUID
    email: str
    username: str
    current_level: float
    target_score: float
    is_online: bool
    last_seen: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """Schema for updating user profile."""
    username: Optional[str] = Field(None, min_length=2, max_length=100)
    current_level: Optional[float] = Field(None, ge=1.0, le=9.0)
    target_score: Optional[float] = Field(None, ge=1.0, le=9.0)


class Token(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    """Schema for decoded token data."""
    user_id: Optional[str] = None
