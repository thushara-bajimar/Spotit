-- =============================================================================
-- SpotIt — 003 application rules enforced by the database
-- The API checks these too (with friendly error codes); the triggers make sure
-- no code path can ever break them.
-- =============================================================================

-- A new application is only possible for an approved, open job with a free place.
CREATE TRIGGER trg_applications_job_accepting BEFORE INSERT ON applications
WHEN NOT EXISTS (
  SELECT 1 FROM jobs
   WHERE id = NEW.job_id
     AND approval_status = 'approved'
     AND status = 'open'
     AND workers_assigned < workers_required
)
BEGIN SELECT RAISE(ABORT, 'job is not accepting applications'); END;

-- Re-applying after a withdrawal (withdrawn → pending) has the same requirement.
CREATE TRIGGER trg_applications_reapply_job_accepting BEFORE UPDATE OF status ON applications
WHEN NEW.status = 'pending' AND OLD.status <> 'pending' AND NOT EXISTS (
  SELECT 1 FROM jobs
   WHERE id = NEW.job_id
     AND approval_status = 'approved'
     AND status = 'open'
     AND workers_assigned < workers_required
)
BEGIN SELECT RAISE(ABORT, 'job is not accepting applications'); END;

-- Allowed status changes:
--   pending   → accepted | rejected | withdrawn
--   withdrawn → pending  (worker applies again)
-- Anything else (e.g. rejected → accepted, accepted → pending) is refused.
CREATE TRIGGER trg_applications_status_transition BEFORE UPDATE OF status ON applications
WHEN NEW.status <> OLD.status AND NOT (
  (OLD.status = 'pending' AND NEW.status IN ('accepted', 'rejected', 'withdrawn'))
  OR (OLD.status = 'withdrawn' AND NEW.status = 'pending')
)
BEGIN SELECT RAISE(ABORT, 'invalid application status transition'); END;

-- Supports the marketplace listing (open + approved, newest first).
CREATE INDEX idx_jobs_open_listing ON jobs (status, approval_status, created_at);
