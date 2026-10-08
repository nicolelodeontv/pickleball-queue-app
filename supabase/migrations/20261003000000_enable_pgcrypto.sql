-- QueueZeroTwo Live View dependency.
-- pgcrypto is required by publish_pickle_session and rotate_pickle_host_key.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
