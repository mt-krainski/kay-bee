-- Add created_at column to funding_organizations table
ALTER TABLE funding_organizations 
ADD COLUMN created_at timestamp with time zone default timezone('utc', now());

-- Update existing records to have a created_at value
UPDATE funding_organizations 
SET created_at = timezone('utc', now()) 
WHERE created_at IS NULL; 
