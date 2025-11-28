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

### ✅ Реализовано (Базовый функционал)

- ✅ Интерактивная карта OpenStreetMap
- ✅ Размещение маркеров старта и финиша кликом по карте
- ✅ Перетаскивание маркеров для корректировки
- ✅ Автоматический расчёт маршрута при установке обеих точек
- ✅ Отображение маршрута на карте (пока простая линия)
- ✅ API endpoint для расчёта маршрута
- ✅ Базовая структура проекта с Docker
- ✅ Настроена Prisma схема для работы с БД

### 🚧 В разработке

- Алгоритм A* для поиска оптимального пути
- Интеграция с OpenTrailMap для данных о тропах
- Загрузка данных высот (SRTM/Mapbox Terrain RGB)
- Система зонирования территории
- Расчёт коэффициентов проходимости
- Панель статистики маршрута
- Высотный профиль
- Сохранение маршрутов в БД
- Экспорт в GPX

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

### Фаза 4: Алгоритм поиска пути 🚧
- [ ] Построение графа
- [ ] A* алгоритм
- [ ] Интеграция данных рельефа
- [ ] Тестирование

### Фаза 5: Статистика и UI
- [ ] Высотный профиль
- [ ] Панель статистики
- [ ] Управление коэффициентами
- [ ] Responsive дизайн

### Фаза 6: Сохранение и экспорт
- [ ] CRUD для маршрутов
- [ ] Экспорт GPX
- [ ] PDF отчёты
- [ ] История маршрутов

## Лицензия

MIT

## Контакты

Для вопросов и предложений создавайте issue в репозитории.
