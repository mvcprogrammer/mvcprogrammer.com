-- mvcprogrammer.com — api/src/Hl7.Etl/Sql/002_requeue.sql
-- Puts every processed message back in the queue, so a feed can be replayed to prove the load is
-- idempotent (the conditional creates find everything already there). Returns the rows requeued.

CREATE OR REPLACE FUNCTION hl7.messages_requeue()
RETURNS integer
LANGUAGE sql
AS $$
    WITH requeued AS (
        UPDATE hl7.messages
        SET processed_at = NULL,
            claimed_at = NULL,
            last_error = NULL,
            fhir_bundle_id = NULL
        WHERE processed_at IS NOT NULL
        RETURNING 1
    )
    SELECT count(*)::integer FROM requeued;
$$;
