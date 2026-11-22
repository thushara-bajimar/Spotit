-- =============================================================================
-- SpotIt — 005 assignments: who did what, capacity bookkeeping, lifecycle rules
-- =============================================================================

-- Extra history for each assignment.
ALTER TABLE assignments ADD COLUMN started_at TEXT;
ALTER TABLE assignments ADD COLUMN cancelled_by INTEGER REFERENCES users (id);
ALTER TABLE assignments ADD COLUMN disputed_at TEXT;
ALTER TABLE assignments ADD COLUMN disputed_by INTEGER REFERENCES users (id);
ALTER TABLE assignments ADD COLUMN dispute_reason TEXT;

-- An assignment can only be created for an accepted application.
CREATE TRIGGER trg_assignments_require_accepted BEFORE INSERT ON assignments
WHEN (SELECT status FROM applications WHERE id = NEW.application_id) IS NOT 'accepted'
BEGIN SELECT RAISE(ABORT, 'assignment requires an accepted application'); END;

-- jobs.workers_assigned is maintained here, never by hand in application code.
-- Together with CHECK (workers_assigned <= workers_required) on jobs this makes
-- overbooking impossible: the insert of one assignment too many is aborted.
CREATE TRIGGER trg_assignments_count_insert AFTER INSERT ON assignments
BEGIN
  UPDATE jobs SET workers_assigned = workers_assigned + 1 WHERE id = NEW.job_id;
END;

CREATE TRIGGER trg_assignments_count_cancel AFTER UPDATE OF status ON assignments
WHEN NEW.status = 'cancelled' AND OLD.status <> 'cancelled'
BEGIN
  UPDATE jobs SET workers_assigned = workers_assigned - 1 WHERE id = NEW.job_id;
END;

-- Open ⇄ filled follows capacity automatically (also when an employer changes
-- the number of workers needed). Other job statuses are left alone.
CREATE TRIGGER trg_jobs_capacity_status AFTER UPDATE OF workers_assigned, workers_required ON jobs
WHEN NEW.status IN ('open', 'filled')
BEGIN
  UPDATE jobs
     SET status = CASE WHEN NEW.workers_assigned >= NEW.workers_required THEN 'filled' ELSE 'open' END
   WHERE id = NEW.id
     AND status <> CASE WHEN NEW.workers_assigned >= NEW.workers_required THEN 'filled' ELSE 'open' END;
END;

-- Allowed assignment status changes:
--   confirmed          → in_progress | completion_pending | cancelled
--   in_progress        → completion_pending | cancelled | disputed
--   completion_pending → completed | disputed
--   disputed           → completed | cancelled     (resolved by an admin)
-- completed and cancelled are final.
CREATE TRIGGER trg_assignments_status_transition BEFORE UPDATE OF status ON assignments
WHEN NEW.status <> OLD.status AND NOT (
  (OLD.status = 'confirmed' AND NEW.status IN ('in_progress', 'completion_pending', 'cancelled'))
  OR (OLD.status = 'in_progress' AND NEW.status IN ('completion_pending', 'cancelled', 'disputed'))
  OR (OLD.status = 'completion_pending' AND NEW.status IN ('completed', 'disputed'))
  OR (OLD.status = 'disputed' AND NEW.status IN ('completed', 'cancelled'))
)
BEGIN SELECT RAISE(ABORT, 'invalid assignment status transition'); END;
