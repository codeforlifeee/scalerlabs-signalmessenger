"""
Contact routes: add, remove, list contacts.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List

from database import get_db
from models import User, Contact
from schemas import ContactAddRequest, ContactResponse, UserResponse
from auth import get_current_user

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("", response_model=List[ContactResponse])
async def list_contacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all contacts for the current user."""
    result = await db.execute(
        select(Contact).where(Contact.user_id == current_user.id)
    )
    contacts = result.scalars().all()
    return [
        ContactResponse(
            id=c.id,
            contact=UserResponse.model_validate(c.contact_user),
            nickname=c.nickname,
            created_at=c.created_at
        )
        for c in contacts
    ]


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def add_contact(
    req: ContactAddRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a new contact by username."""
    # Find the user to add
    result = await db.execute(select(User).where(User.username == req.username))
    contact_user = result.scalar_one_or_none()

    if not contact_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if contact_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add yourself as a contact"
        )

    # Check if already a contact
    existing = await db.execute(
        select(Contact).where(
            and_(
                Contact.user_id == current_user.id,
                Contact.contact_id == contact_user.id
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contact already exists"
        )

    contact = Contact(
        user_id=current_user.id,
        contact_id=contact_user.id
    )
    db.add(contact)
    await db.flush()
    await db.refresh(contact)

    # Also load the contact_user relationship
    await db.refresh(contact, ["contact_user"])

    return ContactResponse(
        id=contact.id,
        contact=UserResponse.model_validate(contact.contact_user),
        nickname=contact.nickname,
        created_at=contact.created_at
    )


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a contact."""
    result = await db.execute(
        select(Contact).where(
            and_(
                Contact.id == contact_id,
                Contact.user_id == current_user.id
            )
        )
    )
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    await db.delete(contact)
