-- An optional photo a child can attach to a reward wish. The file lives in the
-- existing private `proofs` bucket under the child's own folder
-- (`<child_id>/wish-<ts>.<ext>`), so the same RLS that governs quest proofs
-- applies: a child may upload to their own folder and parents may read any
-- proof belonging to a child in their family (via a short-lived signed URL).
alter table reward_requests add column if not exists image_path text;
