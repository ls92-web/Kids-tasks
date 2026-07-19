-- ============================================================================
-- Fix: parents could not actually delete proof media on approval
-- ----------------------------------------------------------------------------
-- The media-purge feature (20260719_purge_media_on_approval.sql) has the
-- client call `supabase.storage.from("proofs").remove([path])` after a
-- parent approves a submission. Storage RLS had no DELETE policy at all for
-- the "proofs" bucket, so the request was silently denied and the file was
-- never actually removed — only the DB pointer (image_path) was cleared.
--
-- Mirrors the existing "parents read family proofs" SELECT policy: a parent
-- may delete a proof file only if it belongs to a child in their own family.
-- ============================================================================

create policy "parents delete family proofs"
on storage.objects for delete
to public
using (
  bucket_id = 'proofs'
  and is_parent()
  and exists (
    select 1 from public.profiles pr
    where pr.id::text = (storage.foldername(objects.name))[1]
      and pr.family_id = my_family_id()
  )
);
