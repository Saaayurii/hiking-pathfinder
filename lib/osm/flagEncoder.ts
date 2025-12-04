/**
 * FlagEncoder - система фильтрации путей на основе тегов OSM
 * Вдохновлено GraphHopper FlagEncoder
 */

export type TransportMode = 'foot' | 'bike' | 'car';

export interface EncodedFlags {
  accessible: boolean;  // Можно ли пройти/проехать
  speed: number;        // Скорость движения (км/ч)
  priority: number;     // Приоритет пути (0-1)
  surface: string;      // Тип поверхности
}

/**
 * Базовый FlagEncoder
 */
export abstract class BaseFlagEncoder {
  protected mode: TransportMode;

  constructor(mode: TransportMode) {
    this.mode = mode;
  }

  abstract encode(tags: Record<string, string>): EncodedFlags;

  /**
   * Проверка доступности пути
   */
  protected isAccessAllowed(tags: Record<string, string>): boolean {
    const accessTag = tags.access;
    const modeTag = tags[this.mode];

    // Явный запрет
    if (accessTag === 'no' || accessTag === 'private' || modeTag === 'no') {
      return false;
    }

    // Явное разрешение
    if (accessTag === 'yes' || modeTag === 'yes' || modeTag === 'designated') {
      return true;
    }

    return this.isDefaultAccessAllowed(tags);
  }

  protected abstract isDefaultAccessAllowed(tags: Record<string, string>): boolean;

  /**
   * Получить скорость на основе тегов
   */
  protected abstract getSpeed(tags: Record<string, string>): number;

  /**
   * Получить приоритет пути
   */
  protected abstract getPriority(tags: Record<string, string>): number;
}

/**
 * FlagEncoder для пешеходов
 */
export class FootFlagEncoder extends BaseFlagEncoder {
  constructor() {
    super('foot');
  }

  encode(tags: Record<string, string>): EncodedFlags {
    const accessible = this.isAccessAllowed(tags);
    const speed = accessible ? this.getSpeed(tags) : 0;
    const priority = accessible ? this.getPriority(tags) : 0;
    const surface = tags.surface || 'unknown';

    return {
      accessible,
      speed,
      priority,
      surface,
    };
  }

  protected isDefaultAccessAllowed(tags: Record<string, string>): boolean {
    const highway = tags.highway;

    // Пешеходные пути
    if (['footway', 'path', 'bridleway', 'cycleway', 'track', 'pedestrian', 'steps'].includes(highway)) {
      return true;
    }

    // Дороги общего пользования
    if (['residential', 'service', 'unclassified', 'road', 'living_street'].includes(highway)) {
      return true;
    }

    // Магистрали запрещены
    if (['motorway', 'motorway_link', 'trunk', 'trunk_link'].includes(highway)) {
      return false;
    }

    return false;
  }

  protected getSpeed(tags: Record<string, string>): number {
    const highway = tags.highway;
    const surface = tags.surface;
    const smoothness = tags.smoothness;

    // Базовая скорость по типу пути
    let speed = 4.0; // 4 км/ч - средняя скорость пешехода

    if (highway === 'footway' || highway === 'pedestrian') {
      speed = 5.0; // Удобная пешеходная дорожка
    } else if (highway === 'path') {
      speed = 4.5;
    } else if (highway === 'steps') {
      speed = 2.0; // Лестницы медленнее
    } else if (highway === 'track') {
      speed = 3.5;
    }

    // Корректировка по поверхности
    if (surface === 'paved' || surface === 'asphalt') {
      speed *= 1.2;
    } else if (surface === 'grass' || surface === 'ground') {
      speed *= 0.9;
    } else if (surface === 'sand' || surface === 'gravel') {
      speed *= 0.7;
    } else if (surface === 'mud') {
      speed *= 0.5;
    }

    // Корректировка по гладкости
    if (smoothness === 'excellent') {
      speed *= 1.1;
    } else if (smoothness === 'bad' || smoothness === 'very_bad') {
      speed *= 0.8;
    }

    return Math.max(0.5, Math.min(6.0, speed)); // 0.5-6 км/ч
  }

  protected getPriority(tags: Record<string, string>): number {
    const highway = tags.highway;
    const foot = tags.foot;
    const surface = tags.surface;

    // Высокий приоритет для специальных пешеходных путей
    if (foot === 'designated' || highway === 'footway' || highway === 'pedestrian') {
      return 1.0;
    }

    // Средний приоритет для троп
    if (highway === 'path' || highway === 'bridleway') {
      return 0.9;
    }

    // Низкий приоритет для дорог
    if (highway === 'residential' || highway === 'service') {
      return 0.5;
    }

    // Бонус за хорошую поверхность
    let priority = 0.7;
    if (surface === 'paved' || surface === 'asphalt') {
      priority += 0.2;
    }

    return Math.max(0.1, Math.min(1.0, priority));
  }
}

/**
 * FlagEncoder для велосипедов
 */
export class BikeFlagEncoder extends BaseFlagEncoder {
  constructor() {
    super('bike');
  }

  encode(tags: Record<string, string>): EncodedFlags {
    const accessible = this.isAccessAllowed(tags);
    const speed = accessible ? this.getSpeed(tags) : 0;
    const priority = accessible ? this.getPriority(tags) : 0;
    const surface = tags.surface || 'unknown';

    return {
      accessible,
      speed,
      priority,
      surface,
    };
  }

  protected isDefaultAccessAllowed(tags: Record<string, string>): boolean {
    const highway = tags.highway;

    // Велосипедные пути
    if (['cycleway', 'path', 'track', 'bridleway'].includes(highway)) {
      return true;
    }

    // Дороги
    if (['residential', 'service', 'unclassified', 'tertiary', 'secondary', 'primary'].includes(highway)) {
      return true;
    }

    // Магистрали запрещены
    if (['motorway', 'motorway_link', 'trunk'].includes(highway)) {
      return false;
    }

    // Лестницы и пешеходные зоны ограничены
    if (['steps', 'pedestrian', 'footway'].includes(highway)) {
      return tags.bicycle === 'yes' || tags.bicycle === 'designated';
    }

    return false;
  }

  protected getSpeed(tags: Record<string, string>): number {
    const highway = tags.highway;
    const surface = tags.surface;

    let speed = 15.0; // 15 км/ч - средняя скорость велосипеда

    if (highway === 'cycleway') {
      speed = 20.0;
    } else if (highway === 'path' || highway === 'track') {
      speed = 12.0;
    } else if (highway === 'residential') {
      speed = 18.0;
    }

    // Корректировка по поверхности
    if (surface === 'paved' || surface === 'asphalt') {
      speed *= 1.3;
    } else if (surface === 'gravel') {
      speed *= 0.7;
    } else if (surface === 'sand' || surface === 'mud') {
      speed *= 0.4;
    }

    return Math.max(3.0, Math.min(30.0, speed)); // 3-30 км/ч
  }

  protected getPriority(tags: Record<string, string>): number {
    const highway = tags.highway;
    const bicycle = tags.bicycle;

    if (bicycle === 'designated' || highway === 'cycleway') {
      return 1.0;
    }

    if (highway === 'residential' || highway === 'service') {
      return 0.7;
    }

    return 0.5;
  }
}

/**
 * Создать encoder по режиму транспорта
 */
export function createEncoder(mode: TransportMode): BaseFlagEncoder {
  switch (mode) {
    case 'foot':
      return new FootFlagEncoder();
    case 'bike':
      return new BikeFlagEncoder();
    case 'car':
      // TODO: Реализовать CarFlagEncoder
      throw new Error('Car encoder not implemented yet');
    default:
      return new FootFlagEncoder();
  }
}

/**
 * Фильтрация OSM элементов по encoder
 */
export function filterWaysByEncoder(
  ways: Array<{
    id: number;
    tags: Record<string, string>;
    nodes: number[];
  }>,
  encoder: BaseFlagEncoder
): Array<{
  id: number;
  tags: Record<string, string>;
  nodes: number[];
  flags: EncodedFlags;
}> {
  return ways
    .map((way) => ({
      ...way,
      flags: encoder.encode(way.tags),
    }))
    .filter((way) => way.flags.accessible);
}
