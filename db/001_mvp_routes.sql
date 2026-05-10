alter table routes
add column if not exists geometry jsonb;

alter table routes
add column if not exists distance_km float8 default 0;

create index if not exists idx_routes_start_end_active
on routes (start_city, end_city, is_active);

create index if not exists idx_deliveries_car_id
on deliveries (car_id);

create index if not exists idx_route_photos_delivery_id
on route_photos (delivery_id);

create index if not exists idx_action_logs_created_at
on action_logs (created_at desc);
