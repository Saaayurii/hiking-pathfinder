'use client';

import { useRef } from 'react';
import type { Route } from '@/types/route';
import { downloadGPX } from '@/lib/export/gpx';
import { exportToPDF } from '@/lib/export/pdf';

interface ExportButtonsProps {
  route: Route;
  elevationCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export default function ExportButtons({ route, elevationCanvasRef }: ExportButtonsProps) {
  const handleGPXExport = () => {
    try {
      downloadGPX(route);
    } catch (error) {
      console.error('Failed to export GPX:', error);
      alert('Ошибка при экспорте в GPX');
    }
  };

  const handlePDFExport = async () => {
    try {
      const canvas = elevationCanvasRef?.current;
      await exportToPDF(route, canvas || undefined);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Ошибка при экспорте в PDF');
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={handleGPXExport}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Экспорт GPX
      </button>

      <button
        onClick={handlePDFExport}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        Экспорт PDF
      </button>
    </div>
  );
}
