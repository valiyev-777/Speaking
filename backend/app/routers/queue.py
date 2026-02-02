from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.session import QueueEntry, QueueMode
from app.schemas.queue import QueueJoinRequest, QueueStatusResponse
from app.utils.security import get_current_user

router = APIRouter()


@router.post("/roulette", response_model=QueueStatusResponse)
async def join_roulette_queue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Join the roulette matchmaking queue."""
    # Check if user is already in a queue
    result = await db.execute(
        select(QueueEntry).where(
            QueueEntry.user_id == current_user.id,
            QueueEntry.is_active == True
        )
    )
    existing_entry = result.scalar_one_or_none()
    
    if existing_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already in a queue"
        )
    
    # Create queue entry
    queue_entry = QueueEntry(
        user_id=current_user.id,
        mode=QueueMode.ROULETTE,
        is_active=True
    )
    
    db.add(queue_entry)
    await db.commit()
    await db.refresh(queue_entry)
    
    # Get position in queue
    position_result = await db.execute(
        select(func.count(QueueEntry.id)).where(
            QueueEntry.mode == QueueMode.ROULETTE,
            QueueEntry.is_active == True,
            QueueEntry.joined_at <= queue_entry.joined_at
        )
    )
    position = position_result.scalar()
    
    return QueueStatusResponse(
        in_queue=True,
        mode="roulette",
        position=position,
        joined_at=queue_entry.joined_at,
        estimated_wait_seconds=20  # Match interval
    )


@router.post("/level-filter", response_model=QueueStatusResponse)
async def join_level_filter_queue(
    request: QueueJoinRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Join the level-filtered matchmaking queue."""
    # Check if user is already in a queue
    result = await db.execute(
        select(QueueEntry).where(
            QueueEntry.user_id == current_user.id,
            QueueEntry.is_active == True
        )
    )
    existing_entry = result.scalar_one_or_none()
    
    if existing_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already in a queue"
        )
    
    # Use provided level filter or user's current level
    level_filter = request.level_filter or current_user.current_level
    
    # Create queue entry
    queue_entry = QueueEntry(
        user_id=current_user.id,
        mode=QueueMode.LEVEL_FILTER,
        level_filter=level_filter,
        is_active=True
    )
    
    db.add(queue_entry)
    await db.commit()
    await db.refresh(queue_entry)
    
    # Get count of users at similar level
    similar_count_result = await db.execute(
        select(func.count(QueueEntry.id)).where(
            QueueEntry.mode == QueueMode.LEVEL_FILTER,
            QueueEntry.is_active == True,
            QueueEntry.level_filter >= level_filter - 0.5,
            QueueEntry.level_filter <= level_filter + 0.5
        )
    )
    similar_count = similar_count_result.scalar()
    
    return QueueStatusResponse(
        in_queue=True,
        mode="level_filter",
        position=similar_count,
        joined_at=queue_entry.joined_at,
        estimated_wait_seconds=30 if similar_count > 1 else 60
    )


@router.post("/leave")
async def leave_queue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Leave the current queue."""
    result = await db.execute(
        select(QueueEntry).where(
            QueueEntry.user_id == current_user.id,
            QueueEntry.is_active == True
        )
    )
    queue_entry = result.scalar_one_or_none()
    
    if not queue_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not in any queue"
        )
    
    queue_entry.is_active = False
    await db.commit()
    
    return {"message": "Left queue successfully"}


@router.get("/status", response_model=QueueStatusResponse)
async def get_queue_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current queue status."""
    result = await db.execute(
        select(QueueEntry).where(
            QueueEntry.user_id == current_user.id,
            QueueEntry.is_active == True
        )
    )
    queue_entry = result.scalar_one_or_none()
    
    if not queue_entry:
        return QueueStatusResponse(in_queue=False)
    
    # Calculate position
    position_result = await db.execute(
        select(func.count(QueueEntry.id)).where(
            QueueEntry.mode == queue_entry.mode,
            QueueEntry.is_active == True,
            QueueEntry.joined_at <= queue_entry.joined_at
        )
    )
    position = position_result.scalar()
    
    return QueueStatusResponse(
        in_queue=True,
        mode=queue_entry.mode.value,
        position=position,
        joined_at=queue_entry.joined_at,
        estimated_wait_seconds=20 if queue_entry.mode == QueueMode.ROULETTE else 30
    )
