-- Mandate MVP schema.
-- Implements the entity contract in product/entity-contract.json.
--
-- Two rules run through every table:
--   1. firm_id and mandate_id are denormalised onto every row that holds document
--      content, so a retrieval query that forgets to join cannot leak across mandates.
--   2. State columns are constrained to the exact state sets named in the entity
--      contract, so an invalid transition fails at the database rather than in the UI.

CREATE TABLE IF NOT EXISTS firms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  state       text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'suspended')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text NOT NULL,
  state       text NOT NULL DEFAULT 'active' CHECK (state IN ('invited', 'active', 'disabled')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, email)
);

CREATE TABLE IF NOT EXISTS mandates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  name          text NOT NULL,
  client_label  text NOT NULL DEFAULT '',
  restricted    boolean NOT NULL DEFAULT false,
  state         text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'archived')),
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  mandate_id  uuid NOT NULL REFERENCES mandates(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('analyst', 'lead', 'partner', 'admin')),
  state       text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'revoked')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mandate_id, user_id)
);

CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships (user_id, state);

CREATE TABLE IF NOT EXISTS ingest_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  mandate_id    uuid NOT NULL REFERENCES mandates(id) ON DELETE CASCADE,
  state         text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'complete')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

CREATE TABLE IF NOT EXISTS documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id           uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  mandate_id        uuid NOT NULL REFERENCES mandates(id) ON DELETE CASCADE,
  ingest_report_id  uuid REFERENCES ingest_reports(id) ON DELETE SET NULL,
  filename          text NOT NULL,
  ext               text NOT NULL CHECK (ext IN ('pdf', 'docx')),
  byte_size         bigint NOT NULL DEFAULT 0,
  storage_path      text NOT NULL,
  page_count        integer,
  state             text NOT NULL DEFAULT 'uploaded'
                    CHECK (state IN ('uploaded', 'parsing', 'indexed', 'failed', 'deleted')),
  error             text,
  uploaded_by       uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_mandate_idx ON documents (mandate_id, state);

CREATE TABLE IF NOT EXISTS document_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  mandate_id    uuid NOT NULL REFERENCES mandates(id) ON DELETE CASCADE,
  document_id   uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ordinal       integer NOT NULL,
  text          text NOT NULL,
  locator_kind  text NOT NULL CHECK (locator_kind IN ('page', 'section')),
  page          integer,
  section       text,
  para_index    integer,
  state         text NOT NULL DEFAULT 'indexed' CHECK (state IN ('indexed', 'superseded')),
  tsv           tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);

-- The retrieval index. Scoping columns come first so the planner can cut to a single
-- mandate before it ever looks at text relevance.
CREATE INDEX IF NOT EXISTS chunks_scope_idx ON document_chunks (mandate_id, state);
CREATE INDEX IF NOT EXISTS chunks_tsv_idx ON document_chunks USING GIN (tsv);
CREATE INDEX IF NOT EXISTS chunks_document_idx ON document_chunks (document_id, ordinal);

CREATE TABLE IF NOT EXISTS research_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  mandate_id          uuid NOT NULL REFERENCES mandates(id) ON DELETE CASCADE,
  question            text NOT NULL,
  state               text NOT NULL DEFAULT 'queued'
                      CHECK (state IN ('queued', 'retrieving', 'answering', 'answered', 'no_evidence', 'failed')),
  answer_text         text,
  answer_mode         text CHECK (answer_mode IN ('extractive', 'generative')),
  model_provider      text,
  model_version       text,
  retrieved_chunk_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  error               text,
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

CREATE INDEX IF NOT EXISTS runs_mandate_idx ON research_runs (mandate_id, created_at DESC);

CREATE TABLE IF NOT EXISTS citations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  mandate_id  uuid NOT NULL REFERENCES mandates(id) ON DELETE CASCADE,
  run_id      uuid NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
  chunk_id    uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  marker      integer NOT NULL,
  quote       text NOT NULL,
  state       text NOT NULL DEFAULT 'proposed'
              CHECK (state IN ('proposed', 'accepted', 'rejected', 'replaced')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS citations_run_idx ON citations (run_id, marker);

CREATE TABLE IF NOT EXISTS evidence_tables (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  mandate_id  uuid NOT NULL REFERENCES mandates(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT 'Briefing evidence',
  state       text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'filling', 'filled', 'partial')),
  row_topics  jsonb NOT NULL DEFAULT '[]'::jsonb,
  columns     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_cells (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  mandate_id      uuid NOT NULL REFERENCES mandates(id) ON DELETE CASCADE,
  table_id        uuid NOT NULL REFERENCES evidence_tables(id) ON DELETE CASCADE,
  row_index       integer NOT NULL,
  col_index       integer NOT NULL,
  state           text NOT NULL DEFAULT 'empty'
                  CHECK (state IN ('empty', 'queued', 'filled', 'not_in_corpus', 'unverified', 'edited')),
  text            text,
  retrieved_text  text,
  run_id          uuid REFERENCES research_runs(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_id, row_index, col_index)
);

CREATE TABLE IF NOT EXISTS briefing_memos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id           uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  mandate_id        uuid NOT NULL REFERENCES mandates(id) ON DELETE CASCADE,
  table_id          uuid REFERENCES evidence_tables(id) ON DELETE SET NULL,
  title             text NOT NULL,
  state             text NOT NULL DEFAULT 'draft'
                    CHECK (state IN ('draft', 'generated', 'pending_approval', 'approved', 'rejected', 'exported')),
  -- Frozen at generation time so the approver signs off exactly the content that
  -- downloads later, even if the evidence table moves on in the meantime.
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  docx_path         text,
  rejection_reason  text,
  generated_by      uuid REFERENCES users(id),
  approved_by       uuid REFERENCES users(id),
  download_token    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memos_mandate_idx ON briefing_memos (mandate_id, created_at DESC);

-- Append-only. The API exposes no update or delete route for this table.
CREATE TABLE IF NOT EXISTS audit_events (
  id             bigserial PRIMARY KEY,
  firm_id        uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  mandate_id     uuid REFERENCES mandates(id) ON DELETE SET NULL,
  actor_user_id  uuid REFERENCES users(id),
  action         text NOT NULL,
  entity         text NOT NULL,
  entity_id      text,
  detail         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_mandate_idx ON audit_events (mandate_id, created_at DESC);
