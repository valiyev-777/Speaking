"""add partnership tables

Revision ID: 002
Revises: 
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create partner_requests table
    op.create_table(
        'partner_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('from_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('to_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Create partnerships table
    op.create_table(
        'partnerships',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user1_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user2_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    
    # Create indexes
    op.create_index('ix_partner_requests_from_user', 'partner_requests', ['from_user_id'])
    op.create_index('ix_partner_requests_to_user', 'partner_requests', ['to_user_id'])
    op.create_index('ix_partnerships_user1', 'partnerships', ['user1_id'])
    op.create_index('ix_partnerships_user2', 'partnerships', ['user2_id'])


def downgrade() -> None:
    op.drop_index('ix_partnerships_user2')
    op.drop_index('ix_partnerships_user1')
    op.drop_index('ix_partner_requests_to_user')
    op.drop_index('ix_partner_requests_from_user')
    op.drop_table('partnerships')
    op.drop_table('partner_requests')
