'use client';

import { useEffect, useRef } from 'react';
import type { ElevationData } from '@/types/route';

interface ElevationProfileProps {
  elevation: ElevationData;
}

export default function ElevationProfile({ elevation }: ElevationProfileProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !elevation.profile || elevation.profile.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Get data ranges
    const profile = elevation.profile;
    const maxDistance = profile[profile.length - 1].distance;
    const minElevation = Math.min(...profile.map((p) => p.elevation));
    const maxElevation = Math.max(...profile.map((p) => p.elevation));
    const elevationRange = maxElevation - minElevation;

    // Scale functions
    const scaleX = (distance: number) =>
      padding + ((distance / maxDistance) * (width - 2 * padding));

    const scaleY = (elev: number) =>
      height - padding - (((elev - minElevation) / elevationRange) * (height - 2 * padding));

    // Draw axes
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw grid lines (horizontal)
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const elev = minElevation + (elevationRange * i) / 4;
      const y = scaleY(elev);

      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(elev)}m`, padding - 5, y + 3);
    }

    // Draw elevation area
    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(scaleX(profile[0].distance), height - padding);

    for (let i = 0; i < profile.length; i++) {
      const x = scaleX(profile[i].distance);
      const y = scaleY(profile[i].elevation);
      ctx.lineTo(x, y);
    }

    ctx.lineTo(scaleX(profile[profile.length - 1].distance), height - padding);
    ctx.closePath();
    ctx.fill();

    // Draw elevation line
    ctx.beginPath();
    ctx.moveTo(scaleX(profile[0].distance), scaleY(profile[0].elevation));

    for (let i = 1; i < profile.length; i++) {
      const x = scaleX(profile[i].distance);
      const y = scaleY(profile[i].elevation);
      ctx.lineTo(x, y);
    }

    ctx.stroke();

    // X-axis labels (distance)
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i <= 4; i++) {
      const distance = (maxDistance * i) / 4;
      const x = scaleX(distance);
      ctx.fillText(
        `${(distance / 1000).toFixed(1)}km`,
        x,
        height - padding + 15
      );
    }

    // Title
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Профиль высот', width / 2, 20);
  }, [elevation]);

  if (!elevation.profile || elevation.profile.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        className="w-full"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  );
}
