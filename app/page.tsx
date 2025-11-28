'use client';

import dynamic from 'next/dynamic';

// Dynamic import for map component (SSR compatibility)
const MapContainer = dynamic(() => import('@/components/Map/MapContainer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-700 mb-2">Загрузка карты...</h2>
        <p className="text-gray-500">Пожалуйста, подождите</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="w-full h-screen overflow-hidden">
      <MapContainer />
    </main>
  );
}
