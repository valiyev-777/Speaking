import json
import logging
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.session import QueueEntry, QueueMode
from app.services.matchmaking import matchmaking_service
from app.utils.security import decode_token

logger = logging.getLogger(__name__)

router = APIRouter()


async def get_user_from_token(token: str) -> User | None:
    """Validate token and get user."""
    payload = decode_token(token)
    if not payload:
        return None
    
    user_id = payload.get("sub")
    if not user_id:
        return None
    
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()


@router.websocket("/ws/match/{user_id}")
async def websocket_match_endpoint(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(...)
):
    """WebSocket endpoint for matchmaking and WebRTC signaling."""
    # Validate token
    user = await get_user_from_token(token)
    if not user or str(user.id) != user_id:
        await websocket.close(code=4001, reason="Invalid authentication")
        return
    
    await websocket.accept()
    logger.info(f"WebSocket connected: {user.username} ({user_id})")
    
    # Register client
    matchmaking_service.register_client(user_id, websocket)
    
    # Update online status
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        db_user = result.scalar_one_or_none()
        if db_user:
            db_user.is_online = True
            db_user.last_seen = datetime.utcnow()
            await db.commit()
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            message_type = message.get("type")
            message_data = message.get("data", {})
            
            if message_type == "join_queue":
                await handle_join_queue(websocket, user_id, message_data)
            
            elif message_type == "leave_queue":
                await handle_leave_queue(websocket, user_id)
            
            elif message_type in ["offer", "answer", "ice_candidate"]:
                await handle_signaling(websocket, user_id, message_type, message_data)
            
            elif message_type == "end_session":
                await handle_end_session(websocket, user_id, message_data)
            
            elif message_type == "chat":
                await handle_chat(websocket, user_id, message_data)
            
            elif message_type == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {user_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {user_id}: {e}")
    finally:
        matchmaking_service.unregister_client(user_id)
        
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            db_user = result.scalar_one_or_none()
            if db_user:
                db_user.is_online = False
                db_user.last_seen = datetime.utcnow()
            
            queue_result = await db.execute(
                select(QueueEntry).where(
                    QueueEntry.user_id == user_id,
                    QueueEntry.is_active == True
                )
            )
            for entry in queue_result.scalars().all():
                entry.is_active = False
            
            await db.commit()


async def handle_join_queue(websocket: WebSocket, user_id: str, data: dict):
    """Handle queue join request."""
    mode = data.get("mode", "roulette")
    level_filter = data.get("level_filter")
    
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(QueueEntry).where(
                QueueEntry.user_id == user_id,
                QueueEntry.is_active == True
            )
        )
        if result.scalar_one_or_none():
            await websocket.send_json({"type": "error", "message": "Already in queue"})
            return
        
        queue_mode = QueueMode.LEVEL_FILTER if mode == "level_filter" else QueueMode.ROULETTE
        
        entry = QueueEntry(
            user_id=user_id,
            mode=queue_mode,
            level_filter=level_filter if queue_mode == QueueMode.LEVEL_FILTER else None,
            is_active=True
        )
        
        db.add(entry)
        await db.commit()
        
        await websocket.send_json({
            "type": "queue_joined",
            "data": {"mode": mode, "level_filter": level_filter}
        })


async def handle_leave_queue(websocket: WebSocket, user_id: str):
    """Handle queue leave request."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(QueueEntry).where(
                QueueEntry.user_id == user_id,
                QueueEntry.is_active == True
            )
        )
        entry = result.scalar_one_or_none()
        if entry:
            entry.is_active = False
            await db.commit()
        
        await websocket.send_json({"type": "queue_left"})


async def handle_signaling(websocket: WebSocket, user_id: str, signal_type: str, data: dict):
    """Handle WebRTC signaling messages."""
    target_user_id = data.get("target_user_id")
    signal_data = data.get("data", data)
    
    if not target_user_id:
        await websocket.send_json({"type": "error", "message": "target_user_id required"})
        return
    
    if target_user_id in matchmaking_service.connected_clients:
        try:
            await matchmaking_service.connected_clients[target_user_id].send_json({
                "type": signal_type,
                "from_user_id": user_id,
                "data": signal_data
            })
        except Exception as e:
            logger.error(f"Signaling error: {e}")


async def handle_end_session(websocket: WebSocket, user_id: str, data: dict):
    """Handle session end request."""
    from app.models.session import Session, SessionStatus
    
    session_id = data.get("session_id")
    
    async with AsyncSessionLocal() as db:
        if session_id:
            result = await db.execute(select(Session).where(Session.id == session_id))
            session = result.scalar_one_or_none()
            
            if session and session.status == SessionStatus.ACTIVE:
                session.status = SessionStatus.COMPLETED
                session.ended_at = datetime.utcnow()
                await db.commit()
                
                partner_id = str(session.user2_id) if str(session.user1_id) == user_id else str(session.user1_id)
                
                if partner_id in matchmaking_service.connected_clients:
                    try:
                        await matchmaking_service.connected_clients[partner_id].send_json({
                            "type": "session_ended",
                            "data": {"session_id": str(session_id)}
                        })
                    except:
                        pass
        
        await websocket.send_json({"type": "session_ended", "data": {"session_id": session_id}})


async def handle_chat(websocket: WebSocket, user_id: str, data: dict):
    """Handle text chat messages."""
    target_user_id = data.get("target_user_id")
    chat_message = data.get("message", "")
    
    if not target_user_id or not chat_message:
        return
    
    if target_user_id in matchmaking_service.connected_clients:
        try:
            await matchmaking_service.connected_clients[target_user_id].send_json({
                "type": "chat",
                "from_user_id": user_id,
                "message": chat_message,
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Chat error: {e}")
