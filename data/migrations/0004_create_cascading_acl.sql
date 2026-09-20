-- Migration: 0004_create_cascading_acl.sql
-- Description: Create access_grants table for cascading access control

CREATE TABLE IF NOT EXISTS access_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK(resource_type IN ('global', 'library', 'shelf')),
  resource_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'curator', 'reader', 'none')),
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_acl_lookup ON access_grants(user_id, resource_type, resource_id);
