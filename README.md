# Hiking Pathfinder

Система поиска оптимальных пеших туристических маршрутов на топографических картах с учётом препятствий и зон проходимости.

## Технологический стек

- **Next.js 16** с Partial Pre-Rendering (PPR)
- **TypeScript** с строгой типизацией
- **React-Leaflet** для интерактивных карт
- **Tailwind CSS** для стилизации
- **PostgreSQL** с Prisma ORM
- **Docker** и Docker Compose

## Быстрый старт

### Предварительные требования

- Docker и Docker Compose
- Node.js 22+ (для локальной разработки)

### Запуск с Docker

```bash
# Клонируйте репозиторий
cd hiking-pathfinder

# Запустите сервисы
docker-compose up -d

# Дождитесь запуска и откройте
# http://localhost:3000
```

### Локальная разработка

```bash
# Установите зависимости
npm install --legacy-peer-deps

# Создайте .env файл
cp .env.example .env

# Запустите PostgreSQL
docker-compose up db -d

# Выполните миграции
npm run prisma:migrate

# Запустите dev сервер
npm run dev
```

## Основные возможности

### ✅ Реализовано

#### Базовая функциональность
- ✅ Интерактивная карта OpenStreetMap с React-Leaflet
- ✅ Размещение маркеров старта и финиша кликом по карте
- ✅ Перетаскивание маркеров с автоматическим пересчётом
- ✅ Отображение маршрута на карте
- ✅ Базовая структура проекта с Docker
- ✅ Prisma ORM с PostgreSQL

#### Данные и анализ рельефа (Фазы 2-3)
- ✅ Интеграция Open-Elevation API для данных высот
- ✅ Overpass API для получения OSM троп
- ✅ Расчёт уклонов с функцией Tobler's
- ✅ Система коэффициентов проходимости (1.0-10.0)
- ✅ Автоматическая классификация зон
- ✅ Панель статистики с elevation gain/loss
- ✅ Elevation profile (canvas chart)

#### Алгоритм A* (Фаза 4)
- ✅ **Реализован полноценный A* алгоритм!**
- ✅ Priority queue (binary heap)
- ✅ Grid-based graph с 8-directional движением
- ✅ Terrain-aware pathfinding с коэффициентами
- ✅ Slope-based edge weights
- ✅ Heuristic functions (Haversine, Euclidean, Manhattan)
- ✅ Douglas-Peucker path smoothing
- ✅ Детальное логирование процесса поиска

#### Статистика и UI (Фаза 5)
- ✅ **Полностью реализованная фаза 5!**
- ✅ Интерактивный высотный профиль (canvas)
- ✅ Детальная панель статистики маршрута
- ✅ Настройка коэффициентов проходимости в UI
- ✅ Автоматический пересчёт маршрута при изменении настроек
- ✅ Responsive дизайн для мобильных устройств
- ✅ Мобильная панель с модальным окном

### 🚧 Планируется

- Полная интеграция с OpenTrailMap векторными тайлами
- Реальные данные троп в граф (сейчас используется uniform terrain)
- Визуальный слой зон проходимости на карте
- Сохранение маршрутов в БД (Фаза 6)
- Экспорт в GPX и PDF (Фаза 6)
- Waypoints support (промежуточные точки)
- Сравнение нескольких вариантов маршрута
- Учёт погодных условий
- Тёмная тема

## Структура проекта

```
hiking-pathfinder/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   ├── page.tsx           # Главная страница
│   └── layout.tsx         # Layout
├── components/            # React компоненты
│   ├── Map/              # Компоненты карты
│   ├── Controls/         # Управление
│   ├── Stats/            # Статистика
│   └── UI/               # UI компоненты
├── lib/                  # Бизнес-логика
│   ├── pathfinding/      # A* алгоритм
│   ├── terrain/          # Работа с рельефом
│   ├── osm/              # OpenStreetMap API
│   └── opentrailmap/     # OpenTrailMap интеграция
├── types/                # TypeScript типы
├── prisma/               # Prisma схема и миграции
└── docker-compose.yml    # Docker конфигурация
```

## API Endpoints

### POST /api/pathfinding

Расчёт маршрута между двумя точками.

**Request:**
```json
{
  "start": { "lat": 55.7558, "lng": 37.6173 },
  "end": { "lat": 55.8558, "lng": 37.7173 }
}
```

**Response:**
```json
{
  "success": true,
  "route": {
    "name": "Новый маршрут",
    "start": { "lat": 55.7558, "lng": 37.6173 },
    "end": { "lat": 55.8558, "lng": 37.7173 },
    "path": [...],
    "distance": 15234,
    "duration": 13710
  }
}
```

## Конфигурация

Переменные окружения в `.env`:

```bash
# База данных
DATABASE_URL="postgresql://postgres:postgres@db:5432/hikingpathfinder?schema=public"

# Mapbox (опционально, для данных высот)
MAPBOX_ACCESS_TOKEN=""

# OpenTrailMap
NEXT_PUBLIC_OPENTRAILMAP_URL="https://tile.opentrailmap.org"

# OSM Tiles
NEXT_PUBLIC_OSM_TILE_URL="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
```

## Команды

```bash
# Разработка
npm run dev              # Запуск dev сервера
npm run build            # Сборка для production
npm run start            # Запуск production сервера

# База данных
npm run prisma:migrate   # Создать и применить миграцию
npm run prisma:studio    # Открыть Prisma Studio

# Docker
docker-compose up        # Запустить все сервисы
docker-compose down      # Остановить сервисы
docker-compose logs -f   # Логи
```

## Roadmap

### Фаза 1: Базовая инфраструктура ✅
- [x] Next.js 16 проект с TypeScript
- [x] Docker и Docker Compose
- [x] Prisma схема
- [x] Базовая структура

### Фаза 2: Карта и визуализация ✅
- [x] React-Leaflet интеграция
- [x] Базовая карта OSM
- [x] Маркеры старт/финиш
- [ ] OpenTrailMap стили

### Фаза 3: Данные и зонирование 🚧
- [ ] Overpass API
- [ ] Данные высот
- [ ] Парсинг OSM
- [ ] Система зонирования
- [ ] Коэффициенты проходимости

### Фаза 4: Алгоритм поиска пути ✅
- [x] Построение графа
- [x] A* алгоритм с priority queue
- [x] Интеграция данных рельефа
- [x] Path smoothing
- [x] Детальное логирование

### Фаза 5: Статистика и UI ✅
- [x] Высотный профиль (canvas chart)
- [x] Панель статистики маршрута
- [x] Интерактивное управление коэффициентами
- [x] Responsive дизайн для мобильных

### Фаза 6: Сохранение и экспорт
- [ ] CRUD для маршрутов
- [ ] Экспорт GPX
- [ ] PDF отчёты
- [ ] История маршрутов

## Лицензия

MIT

## Контакты

Для вопросов и предложений создавайте issue в репозитории.
