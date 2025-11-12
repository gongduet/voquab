-- Add INSERT policy for package_words table
-- Users should be able to insert words for their own packages

CREATE POLICY "Users can insert words for own packages"
ON package_words
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_packages
    WHERE user_packages.package_id = package_words.package_id
    AND user_packages.user_id = auth.uid()
  )
);
