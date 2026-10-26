begin;
alter table public.booking_messages add column attachment_path text;
update public.booking_messages set attachment_path = null;
alter table public.booking_messages add constraint booking_message_attachment_path check (
  attachment_path is null or attachment_path like booking_id::text || '/%'
);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('booking-chat-images', 'booking-chat-images', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic'];
create policy booking_chat_image_read on storage.objects for select to authenticated
using (bucket_id = 'booking-chat-images' and exists (
  select 1 from public.bookings b where b.id::text = split_part(name, '/', 1)
    and (b.customer_id = (select auth.uid()) or b.professional_id = (select auth.uid()))
));
create policy booking_chat_image_insert on storage.objects for insert to authenticated
with check (bucket_id = 'booking-chat-images' and exists (
  select 1 from public.bookings b where b.id::text = split_part(name, '/', 1)
    and (b.customer_id = (select auth.uid()) or b.professional_id = (select auth.uid()))
    and b.professional_id is not null and b.status in ('requested','accepted','on_the_way','in_progress')
));

drop function public.send_booking_message(uuid,uuid,text);
create function public.send_booking_message(p_booking_id uuid,p_client_message_id uuid,p_body text,p_attachment_path text default null)
returns setof public.booking_messages language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); b public.bookings; result public.booking_messages;
begin
  if actor is null then raise exception 'SIGN_IN_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat:'||actor::text,0));
  select * into b from public.bookings where id=p_booking_id for update;
  if not found or (actor is distinct from b.customer_id and actor is distinct from b.professional_id) then raise exception 'CHAT_UNAVAILABLE'; end if;
  if p_client_message_id is null or p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'INVALID_MESSAGE'; end if;
  if p_attachment_path is not null and (p_attachment_path not like p_booking_id::text || '/%' or not exists (
    select 1 from storage.objects o where o.bucket_id='booking-chat-images' and o.name=p_attachment_path)) then raise exception 'INVALID_ATTACHMENT'; end if;
  select * into result from public.booking_messages where sender_id=actor and client_message_id=p_client_message_id;
  if found then
    if result.booking_id<>p_booking_id or result.body<>btrim(p_body) or result.attachment_path is distinct from p_attachment_path then raise exception 'MESSAGE_ID_REUSED'; end if;
    return next result; return;
  end if;
  if b.professional_id is null or b.status not in ('requested','accepted','on_the_way','in_progress') then raise exception 'CHAT_CLOSED'; end if;
  if exists(select 1 from public.booking_messages where sender_id=actor and created_at>clock_timestamp()-interval '1 second') then raise exception 'MESSAGE_RATE_LIMIT'; end if;
  insert into public.booking_messages(booking_id,sender_id,client_message_id,body,attachment_path)
    values(b.id,actor,p_client_message_id,btrim(p_body),p_attachment_path) returning * into result;
  return next result;
end; $$;
revoke all on function public.send_booking_message(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.send_booking_message(uuid,uuid,text,text) to authenticated;
commit;
