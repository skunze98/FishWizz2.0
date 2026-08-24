-- FishWizz — storage object policies, extracted from the staging dump.
--
-- ONLY the policies. supabase/schema/auth_storage.sql also contains 107 create
-- statements for auth.* and storage.* internals that Supabase provisions in
-- every project; replaying those into a fresh project conflicts.
--
-- The three buckets must exist first, and must be PRIVATE. pg_dump does not
-- carry storage.buckets rows (0 inserts in the dump), so create them in the
-- dashboard or with the insert below before applying this file.
--
-- Object keys are '<user_id>/<file>', so every policy scopes on
-- (storage.foldername(name))[1] = auth.uid().

insert into storage.buckets (id, name, public)
values ('inventory-photos','inventory-photos',false),
       ('catch-photos','catch-photos',false),
       ('gear-photos','gear-photos',false)
on conflict (id) do nothing;

CREATE POLICY "catch photo owner delete" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'catch-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "catch photo owner insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'catch-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "catch photo owner read" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'catch-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "catch photo owner update" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'catch-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'catch-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "gear photo owner delete" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'gear-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "gear photo owner insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'gear-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "gear photo owner read" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'gear-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "gear photo owner update" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'gear-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'gear-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY inventory_photos_owner_delete ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'inventory-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

CREATE POLICY inventory_photos_owner_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'inventory-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

CREATE POLICY inventory_photos_owner_select ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'inventory-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

CREATE POLICY inventory_photos_owner_update ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'inventory-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))) WITH CHECK (((bucket_id = 'inventory-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
