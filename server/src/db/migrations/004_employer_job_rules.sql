-- =============================================================================
-- SpotIt — 004 employer job rules enforced by the database
-- =============================================================================

-- Only employers approved by an admin can create jobs.
CREATE TRIGGER trg_jobs_employer_approved BEFORE INSERT ON jobs
WHEN (SELECT verification_status FROM employer_profiles WHERE user_id = NEW.employer_id) IS NOT 'approved'
BEGIN SELECT RAISE(ABORT, 'employer is not approved to post jobs'); END;

-- Allowed job lifecycle changes (approval is tracked separately):
--   draft       → open | cancelled
--   open        → filled | in_progress | closed | cancelled | expired
--   filled      → open | in_progress | closed | cancelled | completed
--   in_progress → completed | cancelled
-- closed, cancelled, expired and completed are final.
CREATE TRIGGER trg_jobs_status_transition BEFORE UPDATE OF status ON jobs
WHEN NEW.status <> OLD.status AND NOT (
  (OLD.status = 'draft' AND NEW.status IN ('open', 'cancelled'))
  OR (OLD.status = 'open' AND NEW.status IN ('filled', 'in_progress', 'closed', 'cancelled', 'expired'))
  OR (OLD.status = 'filled' AND NEW.status IN ('open', 'in_progress', 'closed', 'cancelled', 'completed'))
  OR (OLD.status = 'in_progress' AND NEW.status IN ('completed', 'cancelled'))
)
BEGIN SELECT RAISE(ABORT, 'invalid job status transition'); END;
