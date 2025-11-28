import { jsPDF } from 'jspdf';
import type { Route } from '@/types/route';

/**
 * Export route to PDF format
 */
export async function exportToPDF(route: Route, elevationCanvas?: HTMLCanvasElement): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Title
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(route.name, margin, yPosition);
  yPosition += 12;

  // Date
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  const dateStr = new Date().toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  pdf.text(`Создано: ${dateStr}`, margin, yPosition);
  yPosition += 10;

  // Separator line
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Main statistics
  pdf.setFontSize(14);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Основная информация', margin, yPosition);
  yPosition += 8;

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');

  const distanceKm = (route.distance / 1000).toFixed(2);
  const hours = Math.floor(route.duration / 3600);
  const minutes = Math.floor((route.duration % 3600) / 60);
  const timeStr = hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;

  const stats = [
    `Расстояние: ${distanceKm} км`,
    `Время в пути: ${timeStr}`,
    `Средняя скорость: ${((route.distance / 1000) / (route.duration / 3600)).toFixed(1)} км/ч`,
  ];

  stats.forEach((stat) => {
    pdf.text(stat, margin + 5, yPosition);
    yPosition += 7;
  });

  // Elevation data
  if (route.elevation) {
    yPosition += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Высотные характеристики', margin, yPosition);
    yPosition += 8;

    pdf.setFont('helvetica', 'normal');
    const elevStats = [
      `Набор высоты: ${Math.round(route.elevation.gain)} м`,
      `Сброс высоты: ${Math.round(route.elevation.loss)} м`,
      `Максимальная высота: ${Math.round(route.elevation.max)} м`,
      `Минимальная высота: ${Math.round(route.elevation.min)} м`,
    ];

    elevStats.forEach((stat) => {
      pdf.text(stat, margin + 5, yPosition);
      yPosition += 7;
    });
  }

  // Trail quality
  if (route.trailQuality) {
    yPosition += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Качество троп', margin, yPosition);
    yPosition += 8;

    pdf.setFont('helvetica', 'normal');
    const qualityStats = [
      `Видимость троп: ${translateVisibility(route.trailQuality.avgVisibility)}`,
      `Гладкость поверхности: ${translateSmoothness(route.trailQuality.avgSmoothness)}`,
      `Официальные тропы: ${Math.round(route.trailQuality.officialPercent)}%`,
    ];

    if (route.trailQuality.avgWidth) {
      qualityStats.push(`Средняя ширина: ${route.trailQuality.avgWidth.toFixed(1)} м`);
    }

    qualityStats.forEach((stat) => {
      pdf.text(stat, margin + 5, yPosition);
      yPosition += 7;
    });
  }

  // Elevation profile chart
  if (elevationCanvas) {
    yPosition += 10;
    
    // Check if we need a new page
    if (yPosition + 80 > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.text('Профиль высот', margin, yPosition);
    yPosition += 5;

    try {
      const imgData = elevationCanvas.toDataURL('image/png');
      const imgWidth = pageWidth - 2 * margin;
      const imgHeight = (elevationCanvas.height / elevationCanvas.width) * imgWidth;
      
      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;
    } catch (error) {
      console.error('Failed to add elevation chart to PDF:', error);
    }
  }

  // Coordinates
  yPosition += 5;
  
  // Check if we need a new page
  if (yPosition + 30 > pageHeight - margin) {
    pdf.addPage();
    yPosition = margin;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.text('Координаты', margin, yPosition);
  yPosition += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  
  const coords = [
    `Старт: ${route.start.lat.toFixed(6)}, ${route.start.lng.toFixed(6)}`,
    `Финиш: ${route.end.lat.toFixed(6)}, ${route.end.lng.toFixed(6)}`,
  ];

  coords.forEach((coord) => {
    pdf.text(coord, margin + 5, yPosition);
    yPosition += 6;
  });

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(
    'Создано с помощью Hiking Pathfinder',
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Save PDF
  const filename = sanitizeFilename(route.name);
  pdf.save(`${filename}.pdf`);
}

/**
 * Translate visibility to Russian
 */
function translateVisibility(visibility: string): string {
  const translations: Record<string, string> = {
    excellent: 'Отличная',
    good: 'Хорошая',
    intermediate: 'Средняя',
    bad: 'Плохая',
    horrible: 'Очень плохая',
    no: 'Отсутствует',
  };
  return translations[visibility] || visibility;
}

/**
 * Translate smoothness to Russian
 */
function translateSmoothness(smoothness: string): string {
  const translations: Record<string, string> = {
    excellent: 'Отличная',
    good: 'Хорошая',
    intermediate: 'Средняя',
    bad: 'Плохая',
    very_bad: 'Очень плохая',
    horrible: 'Ужасная',
    very_horrible: 'Непроходимая',
  };
  return translations[smoothness] || smoothness;
}

/**
 * Sanitize filename
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zа-яё0-9\s-]/gi, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 50);
}
