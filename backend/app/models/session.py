import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class QueueMode(str, enum.Enum):
    ROULETTE = "roulette"
    LEVEL_FILTER = "level_filter"


class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class QueueEntry(Base):
    __tablename__ = "queue_entries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    mode = Column(Enum(QueueMode), nullable=False)
    level_filter = Column(Float, nullable=True)  # Only used for level_filter mode
    
    joined_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationship
    user = relationship("User", back_populates="queue_entries")
    
    def __repr__(self):
        return f"<QueueEntry {self.user_id} - {self.mode}>"


class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    user1_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user2_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    mode = Column(Enum(QueueMode), nullable=False)
    room_id = Column(String(100), nullable=False, unique=True)
    
    status = Column(Enum(SessionStatus), default=SessionStatus.ACTIVE)
    
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    
    # Relationships
    user1 = relationship("User", foreign_keys=[user1_id], back_populates="sessions_as_user1")
    user2 = relationship("User", foreign_keys=[user2_id], back_populates="sessions_as_user2")
    
    def __repr__(self):
        return f"<Session {self.id} - {self.user1_id} & {self.user2_id}>"
