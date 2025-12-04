# Новые возможности Hiking Pathfinder

## 🗺️ Мультикартографическая система

### Выбор картографического провайдера

При запуске приложения вам предлагается выбор из трех картографических сервисов:

#### 1. **OpenStreetMap (Leaflet)** ✅ Рекомендуется для туристических маршрутов
- Полностью бесплатный
- Открытые данные
- Лучшее покрытие троп и препятствий
- Детальная информация о рельефе

**Преимущества:**
- Специализированные туристические слои
- Данные о тропах, поверхностях, препятствиях
- Не требует API ключа

#### 2. **Яндекс.Карты**
- Отличная детализация России и СНГ
- Подробные карты городов
- Данные о пробках (для будущих расширений)

**Как получить API ключ:**
1. Перейдите на https://developer.tech.yandex.ru/
2. Создайте аккаунт
3. Создайте ключ API JavaScript для Яндекс.Карт
4. Добавьте ключ в `.env`:
   ```bash
   NEXT_PUBLIC_YANDEX_MAPS_API_KEY="ваш_ключ"
   ```

#### 3. **Google Maps**
- Глобальное покрытие
- Спутниковые снимки высокого разрешения
- Street View
- Terrain mode

**Как получить API ключ:**
1. Перейдите на https://console.cloud.google.com/
2. Создайте проект
3. Включите Maps JavaScript API
4. Создайте credentials (API key)
5. Добавьте ключ в `.env`:
   ```bash
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="ваш_ключ"
   ```

### Переключение между картами

Ваш выбор сохраняется в localStorage. Чтобы изменить карту:
- Очистите localStorage в браузере
- Или удалите ключ `selectedMapProvider`

---

## 🚧 Улучшенная система препятствий

### FlagEncoder - интеллектуальная фильтрация путей

Система FlagEncoder (вдохновлена GraphHopper) автоматически анализирует теги OSM и определяет:

#### Для пешеходов (FootFlagEncoder):
- **Доступность**: можно ли пройти
- **Скорость**: с какой скоростью (0.5-6 км/ч)
- **Приоритет**: насколько путь предпочтителен (0-1)

**Примеры классификации:**
```
highway=footway → доступно, 5 км/ч, приоритет 1.0
highway=path → доступно, 4.5 км/ч, приоритет 0.9
highway=residential → доступно, 4 км/ч, приоритет 0.5
highway=motorway → НЕ доступно
```

**Модификаторы скорости:**
- `surface=paved` → +20% скорости
- `surface=sand` → -30% скорости
- `surface=mud` → -50% скорости
- `smoothness=excellent` → +10% скорости
- `smoothness=bad` → -20% скорости

#### Для велосипедов (BikeFlagEncoder):
- Скорость: 3-30 км/ч
- Учитывает велодорожки, тротуары
- Запрещает лестницы и пешеходные зоны (если не разрешено явно)

---

## 🏗️ Детальная обработка препятствий

### Типы препятствий

Система распознает и обрабатывает 9 типов препятствий:

#### 1. **Здания (Buildings)**
```typescript
{
  type: 'building',
  passable: false,  // Непроходимо
  height: 9,        // Высота в метрах (или levels × 3)
  avoidanceDistance: 2,  // Держаться в 2м от стен
  penaltyCoefficient: 100.0  // Очень высокий штраф
}
```

**Обрабатываются теги:**
- `building=*`
- `building:levels=3` → высота = 9м
- `height=12m` → высота = 12м

#### 2. **Стены (Walls)**
```typescript
{
  type: 'wall',
  passable: false,
  height: 2.5,
  material: 'brick',
  avoidanceDistance: 1,
  penaltyCoefficient: 100.0
}
```

**Типы стен:**
- `barrier=wall` - обычная стена
- `barrier=city_wall` - крепостная стена
- `barrier=retaining_wall` - подпорная стена

#### 3. **Заборы (Fences)**
```typescript
{
  type: 'fence',
  passable: false,
  height: 2.0,
  material: 'wood',
  avoidanceDistance: 0.5,
  penaltyCoefficient: 50.0
}
```

#### 4. **Живые изгороди (Hedges)**
```typescript
{
  type: 'hedge',
  passable: false,
  height: 1.5,
  avoidanceDistance: 0.5,
  penaltyCoefficient: 30.0
}
```

#### 5. **Водоемы (Water bodies)**
```typescript
{
  type: 'water',
  passable: false,
  avoidanceDistance: 5,  // Держаться подальше от берега
  penaltyCoefficient: 100.0
}
```

**Обрабатываются:**
- `natural=water`
- `landuse=reservoir`
- `landuse=basin`

#### 6. **Водотоки (Waterways)**
```typescript
{
  type: 'waterway',
  passable: width < 2,  // Узкие ручьи можно перепрыгнуть
  width: 1.5,
  avoidanceDistance: 0.75,
  penaltyCoefficient: 5.0  // Низкий если узкий
}
```

#### 7. **Обрывы (Cliffs)**
```typescript
{
  type: 'cliff',
  passable: false,
  height: 10,
  avoidanceDistance: 10,  // Опасно подходить близко!
  penaltyCoefficient: 100.0
}
```

#### 8. **Железные дороги (Railways)**
```typescript
{
  type: 'railway',
  passable: false,  // Опасно переходить
  avoidanceDistance: 10,
  penaltyCoefficient: 80.0
}
```

#### 9. **Стройки (Construction)**
```typescript
{
  type: 'construction',
  passable: false,
  avoidanceDistance: 5,
  penaltyCoefficient: 50.0
}
```

### Визуализация препятствий на карте

Каждый тип препятствия отображается своим цветом:

| Тип | Цвет | Код |
|-----|------|-----|
| Здания | Коричневый | #8B4513 |
| Стены | Серый | #696969 |
| Заборы | Светло-серый | #A9A9A9 |
| Изгороди | Зеленый | #228B22 |
| Водоемы | Синий | #1E90FF |
| Водотоки | Голубой | #00BFFF |
| Обрывы | Красный | #B22222 |
| Железные дороги | Черный | #000000 |
| Стройки | Золотой | #FFD700 |

При клике на препятствие отображается popup с информацией:
- Тип препятствия
- Проходимо или нет
- Высота (если есть)
- Ширина (если есть)
- Материал (если есть)
- OSM ID

---

## 🔬 Технические детали

### Обработка сложных зданий

Система поддерживает:

1. **Простые здания** (way с тегом building)
2. **Мультиполигоны** (relation type=building)
   - Собирается геометрия из всех outer ways
   - Учитываются inner ways (внутренние дворы)

### Алгоритмы обнаружения пересечений

#### Проверка пересечения маршрута с препятствием:
```typescript
function doesPathIntersectObstacle(
  from: Point,
  to: Point,
  obstacle: Obstacle
): boolean
```

**Для полигонов** (здания, водоемы):
- Проверка пересечения отрезка с каждым ребром полигона
- Использует детерминант для определения пересечения

**Для линий** (стены, заборы):
- Попарная проверка пересечения отрезков

#### Расстояние до препятствия:
```typescript
function distanceToObstacle(
  point: Point,
  obstacle: Obstacle
): number
```

Вычисляет минимальное расстояние от точки до ближайшего ребра препятствия.

### Штрафы за близость к препятствиям

При построении графа для A*:

```typescript
const distance = distanceToObstacle(node, obstacle);

if (distance < obstacle.properties.avoidanceDistance) {
  const proximityPenalty =
    obstacle.properties.penaltyCoefficient *
    (1 - distance / obstacle.properties.avoidanceDistance);

  nodeCoefficient += proximityPenalty;
}
```

**Пример:**
- Узел в 1м от стены (avoidanceDistance = 1м)
- Штраф = 100.0 × (1 - 1/1) = 0 (на границе)
- Узел в 0.5м от стены
- Штраф = 100.0 × (1 - 0.5/1) = 50.0 (большой штраф!)

---

## 📊 Сравнение с предыдущей версией

| Функция | До | После |
|---------|----|----|
| Картографические провайдеры | 1 (OSM) | 3 (OSM, Яндекс, Google) |
| Типов препятствий | 7 | 9 |
| Парсинг высоты зданий | Нет | Да (height + levels) |
| Обработка мультиполигонов | Нет | Да |
| FlagEncoder система | Нет | Да |
| Визуализация препятствий | Базовая | Детальная с popup |
| Штрафы за близость | Нет | Да (зависят от расстояния) |
| Материалы стен/заборов | Нет | Да |
| Обработка узких водотоков | Все непроходимы | <2м проходимы |

---

## 🚀 Использование

### Базовое использование

1. Запустите приложение
2. Выберите картографический провайдер
3. Поставьте точки старта и финиша
4. Алгоритм автоматически:
   - Загрузит OSM данные
   - Обнаружит препятствия
   - Применит FlagEncoder
   - Построит оптимальный маршрут с учетом всех факторов

### Включение визуализации препятствий

```typescript
import ObstaclesLayer from '@/components/Map/ObstaclesLayer';

<MapContainer>
  <ObstaclesLayer obstacles={obstacles} visible={true} />
</MapContainer>
```

### Использование FlagEncoder

```typescript
import { createEncoder, filterWaysByEncoder } from '@/lib/osm/flagEncoder';

// Создать encoder для пешеходов
const encoder = createEncoder('foot');

// Фильтровать пути OSM
const accessibleWays = filterWaysByEncoder(osmWays, encoder);

// Проверить конкретный путь
const flags = encoder.encode(wayTags);
console.log(flags.accessible);  // true/false
console.log(flags.speed);       // 0-6 км/ч
console.log(flags.priority);    // 0-1
```

---

## 📝 Конфигурация

### API ключи (опционально)

Добавьте в `.env`:
```bash
# Для Яндекс.Карт
NEXT_PUBLIC_YANDEX_MAPS_API_KEY="ваш_ключ"

# Для Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="ваш_ключ"
```

### Настройка режима транспорта

```typescript
// lib/pathfinding/config.ts
export const DEFAULT_TRANSPORT_MODE = 'foot'; // или 'bike'
```

### Настройка расстояний избегания

```typescript
// Можно кастомизировать в lib/osm/obstacles.ts
const customProperties = {
  avoidanceDistance: 5,  // метров
  penaltyCoefficient: 75.0
};
```

---

## 🔮 Будущие улучшения

- [ ] CarFlagEncoder для автомобильных маршрутов
- [ ] Поддержка `access=*` тегов с временными ограничениями
- [ ] Визуализация зон избегания вокруг препятствий
- [ ] Оптимизация для больших областей (spatial indexing)
- [ ] Кэширование OSM данных в IndexedDB
- [ ] Поддержка оффлайн режима

---

## 📚 Ссылки

- [Статья на Habr про OSM и маршрутизацию](https://habr.com/ru/articles/737592/)
- [OpenStreetMap Wiki - Key:highway](https://wiki.openstreetmap.org/wiki/Key:highway)
- [OpenStreetMap Wiki - Key:barrier](https://wiki.openstreetmap.org/wiki/Key:barrier)
- [GraphHopper FlagEncoder](https://github.com/graphhopper/graphhopper/blob/master/docs/core/low-level-api.md)
- [Tobler's hiking function](https://en.wikipedia.org/wiki/Tobler%27s_hiking_function)
