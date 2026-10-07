ALTER TABLE truck_sightings
  ADD COLUMN IF NOT EXISTS license_version TEXT,
  ADD COLUMN IF NOT EXISTS license_confirmed_at TIMESTAMPTZ;
