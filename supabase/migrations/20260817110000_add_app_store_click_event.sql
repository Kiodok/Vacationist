-- iOS is now GA on the App Store — the marketing site's dead "App Store — Coming Soon"
-- placeholders become real links, so track.js needs a real app_store_click event
-- (retiring the old app_store_interest "div with no href" signal). Additive only.

ALTER TABLE public.analytics_events
  DROP CONSTRAINT analytics_events_event_name_check;

ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_event_name_check
  CHECK (event_name IN (
    'page_visit',
    'play_store_click',
    'app_store_click',
    'web_app_click',
    'app_store_interest',
    'sign_up'
  ));
