# AutoTTC

MVP сайта-трекера доставки автомобилей из Китая.

## Возможности MVP

- Публичный поиск доставки по VIN или номеру `AT-000001`.
- Публичная страница трекера: статус, прогресс, маршрут, карта, ETA, фото и комментарии.
- Admin Panel с ролями `admin` и `manager`.
- `admin` создает маршруты и пользователей.
- `manager` добавляет машины и управляет доставками.
- Маршруты строятся через OpenStreetMap/Leaflet/OSRM и сохраняют geometry/distance для повторного использования.
- Фото загружаются с компьютера и привязываются к точке маршрута.
- Основные действия пишутся в `action_logs`.

## Переменные окружения

Создайте `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## База данных

Перед запуском примените миграцию:

```sql
-- db/001_mvp_routes.sql
alter table routes add column if not exists geometry jsonb;
alter table routes add column if not exists distance_km float8 default 0;
```

## Локальный запуск

```bash
npm install
npm run dev
```

## Проверка релиза

```bash
npm run build
npm run start
```

## VPS

В проект добавлены базовые файлы:

- `Dockerfile`
- `docker-compose.yml`
- `nginx/default.conf`
- `.env.example`
- `db/001_mvp_routes.sql`

## Важное после MVP

Перед полноценным публичным продакшеном нужно включить RLS, убрать пароли в открытом виде и перенести авторизацию/права на server-side уровень.
