-- Run this in Supabase SQL Editor to enable account deletion
-- This function allows users to delete their own account

CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete the auth user (this cascades to profiles, listings, messages, etc.)
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;
