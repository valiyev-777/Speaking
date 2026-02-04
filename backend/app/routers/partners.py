from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from uuid import UUID
from typing import List

from app.database import get_db
from app.models import User, PartnerRequest, Partnership, PartnerRequestStatus
from app.schemas.partnership import (
    PartnerRequestCreate,
    PartnerRequestResponse,
    PartnerResponse,
    UserSearchResult
)
from app.utils.security import get_current_user

router = APIRouter(prefix="/partners", tags=["partners"])


@router.get("/search", response_model=List[UserSearchResult])
async def search_users(
    q: str = Query(..., min_length=2, description="Search by username"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search users by username"""
    # Search users (not self)
    result = await db.execute(
        select(User)
        .where(User.username.ilike(f"%{q}%"))
        .where(User.id != current_user.id)
        .limit(20)
    )
    users = result.scalars().all()
    
    # Get existing partnerships
    partnerships_result = await db.execute(
        select(Partnership).where(
            or_(
                Partnership.user1_id == current_user.id,
                Partnership.user2_id == current_user.id
            )
        )
    )
    partnerships = partnerships_result.scalars().all()
    partner_ids = set()
    for p in partnerships:
        if p.user1_id == current_user.id:
            partner_ids.add(p.user2_id)
        else:
            partner_ids.add(p.user1_id)
    
    # Get pending requests
    requests_result = await db.execute(
        select(PartnerRequest).where(
            PartnerRequest.from_user_id == current_user.id,
            PartnerRequest.status == PartnerRequestStatus.PENDING
        )
    )
    pending_requests = requests_result.scalars().all()
    pending_to_ids = {r.to_user_id for r in pending_requests}
    
    return [
        UserSearchResult(
            id=user.id,
            username=user.username,
            current_level=user.current_level,
            is_online=user.is_online,
            is_partner=user.id in partner_ids,
            has_pending_request=user.id in pending_to_ids
        )
        for user in users
    ]


@router.post("/request", response_model=PartnerRequestResponse)
async def send_partner_request(
    request: PartnerRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send partner request (like PUBG friend request)"""
    if request.to_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="O'zingizga so'rov yubora olmaysiz")
    
    # Check if user exists
    target_user = await db.get(User, request.to_user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    
    # Check if already partners
    existing_partnership = await db.execute(
        select(Partnership).where(
            or_(
                and_(Partnership.user1_id == current_user.id, Partnership.user2_id == request.to_user_id),
                and_(Partnership.user1_id == request.to_user_id, Partnership.user2_id == current_user.id)
            )
        )
    )
    if existing_partnership.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Allaqachon sheriklar")
    
    # Check if request already exists
    existing_request = await db.execute(
        select(PartnerRequest).where(
            or_(
                and_(
                    PartnerRequest.from_user_id == current_user.id,
                    PartnerRequest.to_user_id == request.to_user_id,
                    PartnerRequest.status == PartnerRequestStatus.PENDING
                ),
                and_(
                    PartnerRequest.from_user_id == request.to_user_id,
                    PartnerRequest.to_user_id == current_user.id,
                    PartnerRequest.status == PartnerRequestStatus.PENDING
                )
            )
        )
    )
    if existing_request.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="So'rov allaqachon yuborilgan")
    
    # Create request
    partner_request = PartnerRequest(
        from_user_id=current_user.id,
        to_user_id=request.to_user_id
    )
    db.add(partner_request)
    await db.commit()
    await db.refresh(partner_request)
    
    return PartnerRequestResponse(
        id=partner_request.id,
        from_user_id=current_user.id,
        from_username=current_user.username,
        from_level=current_user.current_level,
        to_user_id=target_user.id,
        to_username=target_user.username,
        to_level=target_user.current_level,
        status=partner_request.status,
        created_at=partner_request.created_at
    )


@router.get("/requests/incoming", response_model=List[PartnerRequestResponse])
async def get_incoming_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get incoming partner requests"""
    result = await db.execute(
        select(PartnerRequest)
        .where(
            PartnerRequest.to_user_id == current_user.id,
            PartnerRequest.status == PartnerRequestStatus.PENDING
        )
        .order_by(PartnerRequest.created_at.desc())
    )
    requests = result.scalars().all()
    
    response = []
    for req in requests:
        from_user = await db.get(User, req.from_user_id)
        response.append(PartnerRequestResponse(
            id=req.id,
            from_user_id=req.from_user_id,
            from_username=from_user.username,
            from_level=from_user.current_level,
            to_user_id=current_user.id,
            to_username=current_user.username,
            to_level=current_user.current_level,
            status=req.status,
            created_at=req.created_at
        ))
    
    return response


@router.post("/requests/{request_id}/accept")
async def accept_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Accept partner request"""
    partner_request = await db.get(PartnerRequest, request_id)
    if not partner_request:
        raise HTTPException(status_code=404, detail="So'rov topilmadi")
    
    if partner_request.to_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu so'rov sizga emas")
    
    if partner_request.status != PartnerRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="So'rov allaqachon ko'rib chiqilgan")
    
    # Update request status
    partner_request.status = PartnerRequestStatus.ACCEPTED
    
    # Create partnership
    partnership = Partnership(
        user1_id=partner_request.from_user_id,
        user2_id=partner_request.to_user_id
    )
    db.add(partnership)
    await db.commit()
    
    return {"message": "Sherik qo'shildi!"}


@router.post("/requests/{request_id}/reject")
async def reject_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reject partner request"""
    partner_request = await db.get(PartnerRequest, request_id)
    if not partner_request:
        raise HTTPException(status_code=404, detail="So'rov topilmadi")
    
    if partner_request.to_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu so'rov sizga emas")
    
    if partner_request.status != PartnerRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="So'rov allaqachon ko'rib chiqilgan")
    
    partner_request.status = PartnerRequestStatus.REJECTED
    await db.commit()
    
    return {"message": "So'rov rad etildi"}


@router.get("/", response_model=List[PartnerResponse])
async def get_partners(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get my partners list"""
    result = await db.execute(
        select(Partnership).where(
            or_(
                Partnership.user1_id == current_user.id,
                Partnership.user2_id == current_user.id
            )
        )
        .order_by(Partnership.created_at.desc())
    )
    partnerships = result.scalars().all()
    
    response = []
    for p in partnerships:
        partner_id = p.user2_id if p.user1_id == current_user.id else p.user1_id
        partner = await db.get(User, partner_id)
        response.append(PartnerResponse(
            id=p.id,
            user_id=partner.id,
            username=partner.username,
            current_level=partner.current_level,
            target_score=partner.target_score,
            is_online=partner.is_online,
            last_seen=partner.last_seen,
            partnership_date=p.created_at
        ))
    
    return response


@router.delete("/{partner_user_id}")
async def remove_partner(
    partner_user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove partner"""
    result = await db.execute(
        select(Partnership).where(
            or_(
                and_(Partnership.user1_id == current_user.id, Partnership.user2_id == partner_user_id),
                and_(Partnership.user1_id == partner_user_id, Partnership.user2_id == current_user.id)
            )
        )
    )
    partnership = result.scalar_one_or_none()
    
    if not partnership:
        raise HTTPException(status_code=404, detail="Sherik topilmadi")
    
    await db.delete(partnership)
    await db.commit()
    
    return {"message": "Sherik o'chirildi"}
