'use client';

interface RouteProgressProps {
  stage: 'idle' | 'osm' | 'elevation' | 'graph' | 'pathfinding' | 'complete';
  message?: string;
}

const STAGES = {
  idle: { label: 'Подготовка...', progress: 0 },
  osm: { label: 'Загрузка данных местности...', progress: 20 },
  elevation: { label: 'Получение данных высот...', progress: 40 },
  graph: { label: 'Построение графа местности...', progress: 60 },
  pathfinding: { label: 'Поиск оптимального пути...', progress: 80 },
  complete: { label: 'Маршрут готов!', progress: 100 },
};

export default function RouteProgress({ stage, message }: RouteProgressProps) {
  const stageInfo = STAGES[stage];

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[2000] bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 min-w-[320px] max-w-md">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg
              className="animate-spin h-8 w-8 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Расчёт маршрута</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">{stageInfo.label}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${stageInfo.progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{stageInfo.progress}%</span>
            <span>Это может занять до 30 секунд</span>
          </div>
        </div>

        {/* Optional message */}
        {message && (
          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            {message}
          </div>
        )}

        {/* Stage indicators */}
        <div className="flex justify-between pt-2">
          {Object.entries(STAGES).map(([key, info]) => {
            if (key === 'idle' || key === 'complete') return null;

            const isActive = stage === key;
            const isPast = stageInfo.progress > info.progress;

            return (
              <div key={key} className="flex flex-col items-center flex-1">
                <div
                  className={`w-2 h-2 rounded-full mb-1 transition-colors ${
                    isPast
                      ? 'bg-green-500'
                      : isActive
                      ? 'bg-blue-600 animate-pulse'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                ></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
