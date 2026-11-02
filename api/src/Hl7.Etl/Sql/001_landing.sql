-- mvcprogrammer.com — api/src/Hl7.Etl/Sql/001_landing.sql
-- The HL7 v2 landing schema: every inbound message is a row, claimed in batches by the loader,
-- marked processed or failed in place. The application calls only the functions below; it holds
-- no SQL of its own (the Postgres equivalent of the stored-procedure path in the coding standard).
-- Applied by `dotnet run --project api/src/Hl7.Etl -- migrate`, which records each file in
-- hl7.schema_migrations and never applies one twice.

CREATE SCHEMA IF NOT EXISTS hl7;

CREATE TABLE IF NOT EXISTS hl7.schema_migrations (
    file_name   text        NOT NULL PRIMARY KEY,
    applied_at  timestamptz NOT NULL DEFAULT now()
);

-- The landing table. One row per message as received; the raw text is kept whole so a mapping
-- change can be replayed, and the control id from MSH-10 is unique so a redelivered message lands once.
CREATE TABLE IF NOT EXISTS hl7.messages (
    message_id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_control_id  text        NOT NULL,
    message_type        text        NOT NULL,            -- MSH-9.1, for example ADT or ORU
    trigger_event       text        NOT NULL,            -- MSH-9.2, for example A01 or R01
    sending_facility    text        NOT NULL,            -- MSH-4
    received_at         timestamptz NOT NULL DEFAULT now(),
    raw_message         text        NOT NULL,
    claimed_at          timestamptz NULL,
    processed_at        timestamptz NULL,
    attempt_count       integer     NOT NULL DEFAULT 0,
    last_error          text        NULL,
    fhir_bundle_id      text        NULL,                -- the sandbox's id for the transaction response that took it
    CONSTRAINT messages_control_id_unique UNIQUE (message_control_id)
);

-- The loader's claim query filters on processed_at and claimed_at and orders by message_id.
CREATE INDEX IF NOT EXISTS messages_pending_idx ON hl7.messages (message_id) WHERE processed_at IS NULL;

-- Inserts one message. Returns the new row's id, or NULL when a message with the same control id
-- had already landed (a redelivery), so the caller can count both without a second query.
CREATE OR REPLACE FUNCTION hl7.messages_insert(
    p_message_control_id text,
    p_message_type       text,
    p_trigger_event      text,
    p_sending_facility   text,
    p_received_at        timestamptz,
    p_raw_message        text)
RETURNS bigint
LANGUAGE sql
AS $$
    INSERT INTO hl7.messages (message_control_id, message_type, trigger_event, sending_facility, received_at, raw_message)
    VALUES (p_message_control_id, p_message_type, p_trigger_event, p_sending_facility, p_received_at, p_raw_message)
    ON CONFLICT ON CONSTRAINT messages_control_id_unique DO NOTHING
    RETURNING message_id;
$$;

-- Claims up to p_batch_size unprocessed, unclaimed messages in arrival order for one loader run,
-- skipping rows another run holds (SKIP LOCKED), and returns them with the claim stamped. A row
-- whose claim is older than p_stale_after is treated as abandoned and claimed again.
CREATE OR REPLACE FUNCTION hl7.messages_claim(p_batch_size integer, p_stale_after interval)
RETURNS TABLE (
    message_id         bigint,
    message_control_id text,
    message_type       text,
    trigger_event      text,
    sending_facility   text,
    received_at        timestamptz,
    raw_message        text,
    attempt_count      integer)
LANGUAGE sql
AS $$
    WITH picked AS (
        SELECT m.message_id
        FROM hl7.messages AS m
        WHERE m.processed_at IS NULL
          AND (m.claimed_at IS NULL OR m.claimed_at < now() - p_stale_after)
        ORDER BY m.message_id
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE hl7.messages AS m
    SET claimed_at = now(),
        attempt_count = m.attempt_count + 1
    FROM picked
    WHERE m.message_id = picked.message_id
    RETURNING m.message_id, m.message_control_id, m.message_type, m.trigger_event, m.sending_facility, m.received_at, m.raw_message, m.attempt_count;
$$;

-- Marks a batch processed with the id of the sandbox's transaction response. Returns the rows updated.
CREATE OR REPLACE FUNCTION hl7.messages_complete(p_message_ids bigint[], p_fhir_bundle_id text)
RETURNS integer
LANGUAGE sql
AS $$
    WITH done AS (
        UPDATE hl7.messages
        SET processed_at = now(),
            claimed_at = NULL,
            last_error = NULL,
            fhir_bundle_id = p_fhir_bundle_id
        WHERE message_id = ANY (p_message_ids)
        RETURNING 1
    )
    SELECT count(*)::integer FROM done;
$$;

-- Marks a batch failed with the reason, releasing the claim so the next run tries again. Returns the rows updated.
CREATE OR REPLACE FUNCTION hl7.messages_fail(p_message_ids bigint[], p_error text)
RETURNS integer
LANGUAGE sql
AS $$
    WITH failed AS (
        UPDATE hl7.messages
        SET claimed_at = NULL,
            last_error = left(p_error, 2000)
        WHERE message_id = ANY (p_message_ids)
        RETURNING 1
    )
    SELECT count(*)::integer FROM failed;
$$;

-- The landing table at a glance: how many messages are pending, claimed, processed, and failed (pending with an error).
CREATE OR REPLACE FUNCTION hl7.messages_status()
RETURNS TABLE (pending bigint, claimed bigint, processed bigint, failed bigint)
LANGUAGE sql
AS $$
    SELECT
        count(*) FILTER (WHERE processed_at IS NULL AND claimed_at IS NULL),
        count(*) FILTER (WHERE processed_at IS NULL AND claimed_at IS NOT NULL),
        count(*) FILTER (WHERE processed_at IS NOT NULL),
        count(*) FILTER (WHERE processed_at IS NULL AND last_error IS NOT NULL)
    FROM hl7.messages;
$$;
