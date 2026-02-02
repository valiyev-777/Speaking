import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    username = Column(String(100), nullable=False)
    
    # IELTS levels
    current_level = Column(Float, default=6.0)  # e.g., 5.5, 6.0, 6.5, 7.0
    target_score = Column(Float, default=7.0)
    
    # Online status
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime, default=datetime.utcnow)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    queue_entries = relationship("QueueEntry", back_populates="user", cascade="all, delete-orphan")
    sessions_as_user1 = relationship(
        "Session", 
        foreign_keys="Session.user1_id",
        back_populates="user1",
        cascade="all, delete-orphan"
    )
    sessions_as_user2 = relationship(
        "Session",
        foreign_keys="Session.user2_id", 
        back_populates="user2",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<User {self.username} ({self.email})>"
