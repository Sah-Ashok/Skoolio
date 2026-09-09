-- Migration: Add 'cancelled' status to fee_collection_status_enum
ALTER TYPE fee_collection_status_enum ADD VALUE IF NOT EXISTS 'cancelled';
