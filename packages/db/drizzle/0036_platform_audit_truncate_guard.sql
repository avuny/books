-- PA-R6: close the TRUNCATE hole in the append-only rule for platform_audit_events
-- (row-level BEFORE DELETE triggers do not fire on TRUNCATE).
CREATE TRIGGER platform_audit_events_append_only_truncate
  BEFORE TRUNCATE ON "platform_audit_events"
  FOR EACH STATEMENT EXECUTE FUNCTION platform_audit_events_append_only();
