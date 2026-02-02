import asyncio
import uuid
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.session import QueueEntry, Session, QueueMode, SessionStatus
from app.models.user import User
from app.config import settings

logger = logging.getLogger(__name__)


class MatchmakingService:
    """Service for managing matchmaking between users."""
    
    def __init__(self):
        self._running = False
        self._task: Optional[asyncio.Task] = None
        # In-memory storage for connected WebSocket clients
        # {user_id: websocket_connection}
        self.connected_clients: Dict[str, any] = {}
        # {room_id: [user_id1, user_id2]}
        self.active_rooms: Dict[str, List[str]] = {}
    
    async def start(self):
        """Start the matchmaking background task."""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._matchmaking_loop())
        logger.info("Matchmaking service started")
    
    async def stop(self):
        """Stop the matchmaking background task."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Matchmaking service stopped")
    
    async def _matchmaking_loop(self):
        """Background loop that runs matchmaking every N seconds."""
        while self._running:
            try:
                await self._run_matchmaking()
            except Exception as e:
                logger.error(f"Error in matchmaking loop: {e}")
            
            await asyncio.sleep(settings.roulette_interval_seconds)
    
    async def _run_matchmaking(self):
        """Run one round of matchmaking for all modes."""
        async with AsyncSessionLocal() as db:
            # Run roulette matchmaking
            await self._match_roulette(db)
            
            # Run level-filter matchmaking
            await self._match_level_filter(db)
            
            await db.commit()
    
    async def _match_roulette(self, db: AsyncSession):
        """Match users in roulette mode (random pairing)."""
        # Get all active roulette queue entries
        result = await db.execute(
            select(QueueEntry)
            .where(
                QueueEntry.mode == QueueMode.ROULETTE,
                QueueEntry.is_active == True
            )
            .order_by(QueueEntry.joined_at)
        )
        queue_entries = list(result.scalars().all())
        
        logger.info(f"Roulette queue has {len(queue_entries)} users")
        
        # Pair users
        while len(queue_entries) >= 2:
            entry1 = queue_entries.pop(0)
            entry2 = queue_entries.pop(0)
            
            await self._create_match(db, entry1, entry2)
    
    async def _match_level_filter(self, db: AsyncSession):
        """Match users in level-filter mode (by IELTS level)."""
        # Get all active level-filter queue entries
        result = await db.execute(
            select(QueueEntry)
            .where(
                QueueEntry.mode == QueueMode.LEVEL_FILTER,
                QueueEntry.is_active == True
            )
            .order_by(QueueEntry.joined_at)
        )
        queue_entries = list(result.scalars().all())
        
        logger.info(f"Level-filter queue has {len(queue_entries)} users")
        
        matched_ids = set()
        
        for entry in queue_entries:
            if entry.id in matched_ids:
                continue
            
            # Find a compatible partner
            for other_entry in queue_entries:
                if other_entry.id == entry.id or other_entry.id in matched_ids:
                    continue
                
                # Check if levels are compatible (within 0.5 of each other)
                if abs((entry.level_filter or 6.0) - (other_entry.level_filter or 6.0)) <= 0.5:
                    await self._create_match(db, entry, other_entry)
                    matched_ids.add(entry.id)
                    matched_ids.add(other_entry.id)
                    break
    
    async def _create_match(
        self, 
        db: AsyncSession, 
        entry1: QueueEntry, 
        entry2: QueueEntry
    ):
        """Create a session match between two users."""
        room_id = f"room_{uuid.uuid4().hex[:12]}"
        
        # Create session record
        session = Session(
            user1_id=entry1.user_id,
            user2_id=entry2.user_id,
            mode=entry1.mode,
            room_id=room_id,
            status=SessionStatus.ACTIVE
        )
        
        db.add(session)
        
        # Deactivate queue entries
        entry1.is_active = False
        entry2.is_active = False
        
        await db.flush()
        
        # Get user info for notifications
        user1_result = await db.execute(select(User).where(User.id == entry1.user_id))
        user2_result = await db.execute(select(User).where(User.id == entry2.user_id))
        user1 = user1_result.scalar_one()
        user2 = user2_result.scalar_one()
        
        logger.info(f"Matched {user1.username} with {user2.username} in room {room_id}")
        
        # Store active room
        self.active_rooms[room_id] = [str(entry1.user_id), str(entry2.user_id)]
        
        # Notify users via WebSocket
        await self._notify_match(
            str(entry1.user_id),
            str(entry2.user_id),
            user1,
            user2,
            room_id,
            str(session.id)
        )
    
    async def _notify_match(
        self,
        user1_id: str,
        user2_id: str,
        user1: User,
        user2: User,
        room_id: str,
        session_id: str
    ):
        """Notify matched users via WebSocket."""
        # Notify user 1 about user 2
        if user1_id in self.connected_clients:
            try:
                await self.connected_clients[user1_id].send_json({
                    "type": "matched",
                    "data": {
                        "partner_id": str(user2.id),
                        "partner_username": user2.username,
                        "partner_level": user2.current_level,
                        "room_id": room_id,
                        "session_id": session_id,
                        "is_initiator": True  # User 1 initiates WebRTC offer
                    }
                })
            except Exception as e:
                logger.error(f"Error notifying user {user1_id}: {e}")
        
        # Notify user 2 about user 1
        if user2_id in self.connected_clients:
            try:
                await self.connected_clients[user2_id].send_json({
                    "type": "matched",
                    "data": {
                        "partner_id": str(user1.id),
                        "partner_username": user1.username,
                        "partner_level": user1.current_level,
                        "room_id": room_id,
                        "session_id": session_id,
                        "is_initiator": False  # User 2 waits for offer
                    }
                })
            except Exception as e:
                logger.error(f"Error notifying user {user2_id}: {e}")
    
    def register_client(self, user_id: str, websocket):
        """Register a WebSocket client."""
        self.connected_clients[user_id] = websocket
        logger.info(f"Client {user_id} connected. Total clients: {len(self.connected_clients)}")
    
    def unregister_client(self, user_id: str):
        """Unregister a WebSocket client."""
        if user_id in self.connected_clients:
            del self.connected_clients[user_id]
            logger.info(f"Client {user_id} disconnected. Total clients: {len(self.connected_clients)}")
    
    async def forward_signaling(self, from_user_id: str, to_user_id: str, message: dict):
        """Forward WebRTC signaling messages between peers."""
        if to_user_id in self.connected_clients:
            try:
                await self.connected_clients[to_user_id].send_json({
                    "type": message.get("type"),
                    "from_user_id": from_user_id,
                    "data": message.get("data")
                })
            except Exception as e:
                logger.error(f"Error forwarding signaling from {from_user_id} to {to_user_id}: {e}")


# Global matchmaking service instance
matchmaking_service = MatchmakingService()
