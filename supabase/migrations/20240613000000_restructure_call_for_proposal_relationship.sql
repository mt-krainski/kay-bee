-- Restructure call_for_proposal and grant_versions relationship
-- Remove grant_version_id from call_for_proposal table
ALTER TABLE call_for_proposal DROP CONSTRAINT IF EXISTS call_for_proposal_grant_version_id_fkey;
ALTER TABLE call_for_proposal DROP COLUMN IF EXISTS grant_version_id;

-- Add call_for_proposal_id to grant_versions table (nullable, no cascade delete)
ALTER TABLE grant_versions ADD COLUMN call_for_proposal_id uuid REFERENCES call_for_proposal(id); 
