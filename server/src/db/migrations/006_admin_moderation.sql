-- =============================================================================
-- SpotIt — 006 admin moderation
-- =============================================================================

-- 1. The audit log must also record decisions on assignments (dispute
--    resolution). SQLite cannot alter a CHECK constraint, so the table is
--    rebuilt with its rows copied over unchanged. The append-only triggers are
--    dropped only for the rebuild and recreated immediately.
DROP TRIGGER trg_admin_actions_no_update;
DROP TRIGGER trg_admin_actions_no_delete;
DROP TRIGGER trg_admin_actions_admin_role;

CREATE TABLE admin_actions_new (
  id          INTEGER PRIMARY KEY,
  admin_id    INTEGER NOT NULL REFERENCES users (id),
  action      TEXT    NOT NULL,   -- e.g. 'employer.approve', 'job.reject', 'user.suspend'
  target_type TEXT    NOT NULL CHECK (target_type IN ('user', 'employer', 'job', 'report', 'review', 'assignment')),
  target_id   INTEGER NOT NULL,
  reason      TEXT,
  details     TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(details) AND json_type(details) = 'object'),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

INSERT INTO admin_actions_new (id, admin_id, action, target_type, target_id, reason, details, created_at)
SELECT id, admin_id, action, target_type, target_id, reason, details, created_at FROM admin_actions;

DROP TABLE admin_actions;
ALTER TABLE admin_actions_new RENAME TO admin_actions;

CREATE INDEX idx_admin_actions_created ON admin_actions (created_at);
CREATE INDEX idx_admin_actions_target  ON admin_actions (target_type, target_id);

CREATE TRIGGER trg_admin_actions_admin_role BEFORE INSERT ON admin_actions
WHEN (SELECT role FROM users WHERE id = NEW.admin_id) IS NOT 'admin'
BEGIN SELECT RAISE(ABORT, 'admin_actions.admin_id must reference an admin'); END;

CREATE TRIGGER trg_admin_actions_no_update BEFORE UPDATE ON admin_actions
BEGIN SELECT RAISE(ABORT, 'admin_actions is append-only'); END;

CREATE TRIGGER trg_admin_actions_no_delete BEFORE DELETE ON admin_actions
BEGIN SELECT RAISE(ABORT, 'admin_actions is append-only'); END;

-- 2. Report lifecycle:
--   pending      → under_review | resolved | dismissed
--   under_review → resolved | dismissed
-- resolved and dismissed are final.
CREATE TRIGGER trg_reports_status_transition BEFORE UPDATE OF status ON reports
WHEN NEW.status <> OLD.status AND NOT (
  (OLD.status = 'pending' AND NEW.status IN ('under_review', 'resolved', 'dismissed'))
  OR (OLD.status = 'under_review' AND NEW.status IN ('resolved', 'dismissed'))
)
BEGIN SELECT RAISE(ABORT, 'invalid report status transition'); END;

-- 3. Admin users list sorts by newest first.
CREATE INDEX idx_users_created ON users (created_at);
