-- Keep immutable asset metadata while recording that the actual bytes were removed.
ALTER TABLE file_assets ADD COLUMN purged_at timestamptz;
