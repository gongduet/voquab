-- Add is_admin column to user_settings
-- Only super admins can grant admin access (done manually in Supabase)

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN user_settings.is_admin IS 'Admin access flag. Only granted manually by super admin.';
