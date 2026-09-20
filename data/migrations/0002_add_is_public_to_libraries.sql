-- Migration: 0002_add_is_public_to_libraries.sql
-- Description: Add is_public column to libraries table for guest/unauthenticated access

ALTER TABLE libraries ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
