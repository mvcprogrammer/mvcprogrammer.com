-- mvcprogrammer.com — api/src/Hl7.Etl/Sql/003_fail_keeps_claim.sql
-- A failed batch keeps its claim, so the same run does not take it again at once; the next run
-- after the stale window (messages_claim's p_stale_after) retries it. Replaces the 001 version,
-- which released the claim and let a run spin on a batch the server kept rejecting.

CREATE OR REPLACE FUNCTION hl7.messages_fail(p_message_ids bigint[], p_error text)
RETURNS integer
LANGUAGE sql
AS $$
    WITH failed AS (
        UPDATE hl7.messages
        SET last_error = left(p_error, 2000)
        WHERE message_id = ANY (p_message_ids)
        RETURNING 1
    )
    SELECT count(*)::integer FROM failed;
$$;
