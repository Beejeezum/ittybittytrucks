CREATE TABLE IF NOT EXISTS visitor_signals (
  visitor_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (visitor_key, kind)
);

CREATE TABLE IF NOT EXISTS truck_requests (
  id UUID PRIMARY KEY,
  request_key UUID NOT NULL UNIQUE,
  visitor_key UUID NOT NULL,
  intent TEXT NOT NULL CHECK (intent IN ('follow', 'truck')),
  contact_type TEXT NOT NULL CHECK (contact_type IN ('email', 'phone')),
  contact_value TEXT NOT NULL,
  consent TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
);

CREATE TABLE IF NOT EXISTS truck_sightings (
  id UUID PRIMARY KEY,
  request_key UUID NOT NULL UNIQUE,
  visitor_key UUID NOT NULL,
  object_key TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS submission_limits (
  key TEXT PRIMARY KEY,
  bucket BIGINT NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS site_visits (
  id UUID PRIMARY KEY,
  visitor_key UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  referrer_host TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT 'unknown'
);

CREATE INDEX IF NOT EXISTS idx_submission_limits_bucket ON submission_limits(bucket);
CREATE INDEX IF NOT EXISTS idx_site_visits_started_at ON site_visits(started_at);
CREATE INDEX IF NOT EXISTS idx_site_visits_last_seen_at ON site_visits(last_seen_at);
