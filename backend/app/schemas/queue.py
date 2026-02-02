from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field
from uuid import UUID


class QueueJoinRequest(BaseModel):
    """Schema for joining a queue."""
    level_filter: Optional[float] = Field(None, ge=1.0, le=9.0, description="IELTS level to match with (for level-filter mode)")


class QueueStatusResponse(BaseModel):
    """Schema for queue status."""
    in_queue: bool
    mode: Optional[str] = None
    position: Optional[int] = None
    joined_at: Optional[datetime] = None
    estimated_wait_seconds: Optional[int] = None


class MatchResponse(BaseModel):
    """Schema for match found response."""
    matched: bool
    partner_id: Optional[UUID] = None
    partner_username: Optional[str] = None
    partner_level: Optional[float] = None
    room_id: Optional[str] = None
    session_id: Optional[UUID] = None


class PartnerInfo(BaseModel):
    """Schema for partner information."""
    id: UUID
    username: str
    current_level: float
    target_score: float
    
    class Config:
        from_attributes = True


# WebSocket message types
class WSMessage(BaseModel):
    """Base WebSocket message."""
    type: str
    data: Optional[dict] = None


class WSJoinQueue(BaseModel):
    """WebSocket message to join queue."""
    type: Literal["join_queue"] = "join_queue"
    mode: Literal["roulette", "level_filter"]
    level_filter: Optional[float] = None


class WSLeaveQueue(BaseModel):
    """WebSocket message to leave queue."""
    type: Literal["leave_queue"] = "leave_queue"


class WSSignaling(BaseModel):
    """WebSocket message for WebRTC signaling."""
    type: Literal["offer", "answer", "ice_candidate"]
    target_user_id: UUID
    data: dict


class WSEndSession(BaseModel):
    """WebSocket message to end session."""
    type: Literal["end_session"] = "end_session"
    session_id: UUID
