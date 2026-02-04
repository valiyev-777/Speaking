from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from uuid import UUID

from app.models.partnership import PartnerRequestStatus


class PartnerRequestCreate(BaseModel):
    """Send partner request"""
    to_user_id: UUID


class PartnerRequestResponse(BaseModel):
    """Partner request response"""
    id: UUID
    from_user_id: UUID
    from_username: str
    from_level: float
    to_user_id: UUID
    to_username: str
    to_level: float
    status: PartnerRequestStatus
    created_at: datetime
    
    class Config:
        from_attributes = True


class PartnerResponse(BaseModel):
    """Partner info"""
    id: UUID
    user_id: UUID
    username: str
    current_level: float
    target_score: float
    is_online: bool
    last_seen: datetime
    partnership_date: datetime
    
    class Config:
        from_attributes = True


class UserSearchResult(BaseModel):
    """User search result"""
    id: UUID
    username: str
    current_level: float
    is_online: bool
    is_partner: bool  # Already partners?
    has_pending_request: bool  # Request sent?
    
    class Config:
        from_attributes = True
