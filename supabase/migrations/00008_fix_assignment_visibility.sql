-- =============================================================================
-- Migration: Fix assignment visibility for athletes
--
-- Problems:
-- 1. RLS policy only checks target_user_id, not group membership.
--    Athletes assigned via group cannot see their assignments.
-- 2. assigned_by column is never populated (fixed in frontend).
-- 3. scheduled_slot column is missing — slot info is lost.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add scheduled_slot column to session_assignments
-- ---------------------------------------------------------------------------
ALTER TABLE session_assignments
    ADD COLUMN IF NOT EXISTS scheduled_slot TEXT
    CHECK (scheduled_slot IS NULL OR scheduled_slot IN ('morning', 'evening'));

-- ---------------------------------------------------------------------------
-- 2. Fix RLS: athletes must see assignments targeting their group
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS assignments_select ON session_assignments;

CREATE POLICY assignments_select ON session_assignments FOR SELECT
    USING (
        target_user_id = app_user_id()
        OR assigned_by = app_user_id()
        OR app_user_role() IN ('admin', 'coach')
        OR target_group_id IN (
            SELECT group_id FROM group_members WHERE user_id = app_user_id()
        )
    );
