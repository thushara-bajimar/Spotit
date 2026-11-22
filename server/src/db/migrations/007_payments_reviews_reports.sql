-- =============================================================================
-- SpotIt — 007 payment tracking, reviews and user reports
-- SpotIt records payments that happen outside the app; it does not move money.
-- =============================================================================

-- What was actually paid (can differ from the agreed rate, e.g. 3 days × ₹600).
ALTER TABLE payments ADD COLUMN amount_paid INTEGER CHECK (amount_paid IS NULL OR amount_paid BETWEEN 1 AND 10000000);
ALTER TABLE payments ADD COLUMN disputed_at TEXT;
ALTER TABLE payments ADD COLUMN dispute_reason TEXT;

-- Payment status changes:
--   pending  → paid | disputed
--   paid     → disputed        (worker says it was not received)
--   disputed → paid            (employer records the payment again)
-- Once the worker has confirmed receipt the payment is final.
CREATE TRIGGER trg_payments_status_transition BEFORE UPDATE OF status ON payments
WHEN NEW.status <> OLD.status AND (
  OLD.worker_confirmed_at IS NOT NULL
  OR NOT (
    (OLD.status = 'pending' AND NEW.status IN ('paid', 'disputed'))
    OR (OLD.status = 'paid' AND NEW.status = 'disputed')
    OR (OLD.status = 'disputed' AND NEW.status = 'paid')
  )
)
BEGIN SELECT RAISE(ABORT, 'invalid payment status transition'); END;

-- A worker can only confirm receipt of a payment marked as paid.
CREATE TRIGGER trg_payments_worker_confirm BEFORE UPDATE OF worker_confirmed_at ON payments
WHEN NEW.worker_confirmed_at IS NOT NULL AND NEW.status <> 'paid'
BEGIN SELECT RAISE(ABORT, 'only a paid payment can be confirmed'); END;

-- Fast checks for "you already reported this" and for a user's open reports.
CREATE INDEX idx_reports_reporter_status ON reports (reporter_id, status);
