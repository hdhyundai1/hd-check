import { Worker } from '../types';

export interface RenderWorkerOptions {
  workers: Worker[];
  totalWorkerCount: number;
  startIndex: number;
  roundLabel: string;
  companyTitle: string;
  tabTitle: string;
  currentTab: 'all' | 'un' | 'ok';
  stats: { total: number; ok: number; no: number };
  checkerName: string;
  dateStr: string;
  pageInfo?: { current: number; total: number };
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill?: string,
  stroke?: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  ctx.restore();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let len = text.length;
  while (len > 1 && ctx.measureText(text.slice(0, len) + '…').width > maxWidth) {
    len--;
  }
  return text.slice(0, len) + '…';
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  bgColor: string,
  borderColor: string,
  textColor: string
) {
  const x = centerX - width / 2;
  const y = centerY - height / 2;
  drawRoundRect(ctx, x, y, width, height, 4, bgColor, borderColor);
  ctx.save();
  ctx.fillStyle = textColor;
  ctx.font = "bold 11px 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, centerX, centerY + 0.5);
  ctx.restore();
}

export function renderWorkerListToCanvas(options: RenderWorkerOptions): HTMLCanvasElement {
  const {
    workers,
    totalWorkerCount,
    startIndex,
    roundLabel,
    companyTitle,
    tabTitle,
    currentTab,
    stats,
    checkerName,
    dateStr,
    pageInfo,
  } = options;

  const canvas = document.createElement('canvas');
  const baseWidth = 860;
  const headerHeight = 220;
  const rowHeight = 36;
  const footerHeight = 85;
  const baseHeight = headerHeight + workers.length * rowHeight + footerHeight;

  // Use scale 2 for retina crispness, but cap if height is extremely large
  const scale = baseHeight > 3500 ? 1.5 : 2;

  canvas.width = Math.round(baseWidth * scale);
  canvas.height = Math.round(baseHeight * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D canvas context');

  ctx.scale(scale, scale);

  // 1. Background fill
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, baseWidth, baseHeight);

  // Outer border
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, baseWidth - 1, baseHeight - 1);

  // 2. Top Header Bar (Y: 28 ~ 56)
  let badgeX = 32;

  // Badge 1: App Title
  ctx.font = "bold 11px 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const b1Text = "현장 출입점검 관리시스템";
  const b1Width = ctx.measureText(b1Text).width + 16;
  drawRoundRect(ctx, badgeX, 26, b1Width, 24, 4, '#0F172A');
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b1Text, badgeX + b1Width / 2, 38);
  badgeX += b1Width + 8;

  // Badge 2: Round label
  const b2Text = roundLabel || "점검 차수";
  const b2Width = ctx.measureText(b2Text).width + 16;
  drawRoundRect(ctx, badgeX, 26, b2Width, 24, 4, '#DBEAFE', '#BFDBFE');
  ctx.fillStyle = '#1E40AF';
  ctx.fillText(b2Text, badgeX + b2Width / 2, 38);
  badgeX += b2Width + 8;

  // Badge 3: Page info (if paginated)
  if (pageInfo && pageInfo.total > 1) {
    const pageText = `[${pageInfo.current} / ${pageInfo.total} 페이지]`;
    const pageBadgeWidth = ctx.measureText(pageText).width + 16;
    drawRoundRect(ctx, badgeX, 26, pageBadgeWidth, 24, 4, '#FEF3C7', '#FDE68A');
    ctx.fillStyle = '#92400E';
    ctx.fillText(pageText, badgeX + pageBadgeWidth / 2, 38);
  }

  // Right side: 발송일시
  ctx.fillStyle = '#64748B';
  ctx.font = "500 12px 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`발송일시: ${dateStr}`, baseWidth - 32, 38);

  // 3. Main Title (Y: 66 ~ 100)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  let titleX = 32;
  const titleY = 88;

  let tabBadgeText = '[전체] ';
  let tabBadgeColor = '#0F172A';
  if (currentTab === 'un') {
    tabBadgeText = '🚨 [미확인] ';
    tabBadgeColor = '#DC2626';
  } else if (currentTab === 'ok') {
    tabBadgeText = '✅ [확인완료] ';
    tabBadgeColor = '#16A34A';
  }

  ctx.font = "900 20px 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = tabBadgeColor;
  ctx.fillText(tabBadgeText, titleX, titleY);
  titleX += ctx.measureText(tabBadgeText).width;

  ctx.fillStyle = '#0F172A';
  ctx.fillText('출입점검 대상자 명단 ', titleX, titleY);
  titleX += ctx.measureText('출입점검 대상자 명단 ').width;

  ctx.fillStyle = '#64748B';
  ctx.font = "bold 17px 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`(${companyTitle})`, titleX, titleY);

  // 4. Quick Summary Stats Card (Y: 108 ~ 168, Height: 60)
  const statsBoxY = 104;
  const statsBoxH = 60;
  const tableX = 32;
  const tableWidth = 796;

  drawRoundRect(ctx, tableX, statsBoxY, tableWidth, statsBoxH, 8, '#F8FAFC', '#E2E8F0');

  const colW = tableWidth / 4;
  const statCols = [
    { label: '점검 대상', value: companyTitle, color: '#0F172A', size: '13px' },
    { label: '명단 총원', value: `${(totalWorkerCount || 0).toLocaleString()} 명`, color: '#2563EB', size: '15px' },
    { label: '업체 미확인 현황', value: `${(stats.no || 0).toLocaleString()} 명`, color: '#DC2626', size: '15px' },
    { 
      label: '점검 완료율', 
      value: `${stats.total > 0 ? Math.round((stats.ok / stats.total) * 100) : 0}%`, 
      color: '#16A34A', 
      size: '15px' 
    },
  ];

  statCols.forEach((col, idx) => {
    const colX = tableX + idx * colW + 16;
    // Sub-label
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748B';
    ctx.font = "500 11px 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(col.label, colX, statsBoxY + 22);

    // Value
    ctx.fillStyle = col.color;
    ctx.font = `bold ${col.size} 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    const truncatedVal = truncateText(ctx, col.value, colW - 24);
    ctx.fillText(truncatedVal, colX, statsBoxY + 44);

    // Vertical divider between stats columns (except last)
    if (idx < 3) {
      ctx.beginPath();
      ctx.strokeStyle = '#E2E8F0';
      ctx.moveTo(tableX + (idx + 1) * colW, statsBoxY + 12);
      ctx.lineTo(tableX + (idx + 1) * colW, statsBoxY + statsBoxH - 12);
      ctx.stroke();
    }
  });

  // 5. Table Header (Y: 178 ~ 214, Height: 36)
  const tableTopY = 178;
  const cols = [
    { title: 'No.', width: 48, align: 'center' as const },
    { title: '성명', width: 112, align: 'left' as const },
    { title: '생년월일', width: 110, align: 'left' as const },
    { title: '소속 업체', width: 188, align: 'left' as const },
    { title: '출입점검 상태', width: 124, align: 'center' as const },
    { title: '비고 / 사유', width: 214, align: 'left' as const },
  ];

  // Header Background
  drawRoundRect(ctx, tableX, tableTopY, tableWidth, 36, 4, '#1E293B');

  let curX = tableX;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = "bold 12px 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textBaseline = 'middle';

  cols.forEach((col, idx) => {
    if (col.align === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(col.title, curX + col.width / 2, tableTopY + 18);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(col.title, curX + 12, tableTopY + 18);
    }

    // Column divider line in header
    if (idx < cols.length - 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#334155';
      ctx.moveTo(curX + col.width, tableTopY + 6);
      ctx.lineTo(curX + col.width, tableTopY + 30);
      ctx.stroke();
    }

    curX += col.width;
  });

  // 6. Table Rows
  const rowsStartY = tableTopY + 36;

  workers.forEach((worker, rowIdx) => {
    const rowY = rowsStartY + rowIdx * rowHeight;
    const isEven = rowIdx % 2 === 0;

    // Row Background (Zebra Striping)
    ctx.fillStyle = isEven ? '#FFFFFF' : '#F8FAFC';
    ctx.fillRect(tableX, rowY, tableWidth, rowHeight);

    // Row bottom border
    ctx.beginPath();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.moveTo(tableX, rowY + rowHeight);
    ctx.lineTo(tableX + tableWidth, rowY + rowHeight);
    ctx.stroke();

    const isConfirmed = worker.status?.trim() === '확인';
    const isPending = !worker.status;
    const hasOtherReason = worker.status && !isConfirmed;

    let cellX = tableX;

    // Col 0: No.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#64748B';
    ctx.font = "600 12px 'Pretendard', -apple-system, BlinkMacSystemFont, monospace";
    ctx.fillText(String(startIndex + rowIdx + 1), cellX + cols[0].width / 2, rowY + rowHeight / 2);
    cellX += cols[0].width;

    // Col 1: 성명
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = "bold 13px 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const displayName = worker.name || '-';
    ctx.fillText(truncateText(ctx, displayName, cols[1].width - 16), cellX + 12, rowY + rowHeight / 2);
    cellX += cols[1].width;

    // Col 2: 생년월일
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = "500 12px 'Pretendard', -apple-system, BlinkMacSystemFont, monospace";
    ctx.fillText(worker.dob || '-', cellX + 12, rowY + rowHeight / 2);
    cellX += cols[2].width;

    // Col 3: 소속 업체
    ctx.textAlign = 'left';
    ctx.fillStyle = '#334155';
    ctx.font = "500 12px 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const compText = truncateText(ctx, worker.company || '-', cols[3].width - 16);
    ctx.fillText(compText, cellX + 12, rowY + rowHeight / 2);
    cellX += cols[3].width;

    // Col 4: 출입점검 상태 Badge
    const badgeCenter = cellX + cols[4].width / 2;
    const badgeY = rowY + rowHeight / 2;

    if (isPending) {
      drawBadge(ctx, '미확인', badgeCenter, badgeY, 56, 22, '#FEE2E2', '#FCA5A5', '#DC2626');
    } else if (isConfirmed) {
      drawBadge(ctx, '확인완료', badgeCenter, badgeY, 64, 22, '#DCFCE7', '#86EFAC', '#16A34A');
    } else if (hasOtherReason) {
      const statusLabel = truncateText(ctx, worker.status || '부재', 54);
      drawBadge(ctx, statusLabel, badgeCenter, badgeY, 64, 22, '#FEF3C7', '#FCD34D', '#D97706');
    }
    cellX += cols[4].width;

    // Col 5: 비고 / 사유
    ctx.textAlign = 'left';
    ctx.font = "500 11px 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    if (isPending) {
      ctx.fillStyle = '#EF4444';
      ctx.fillText(truncateText(ctx, worker.remark || '출입 점검 필요', cols[5].width - 16), cellX + 12, rowY + rowHeight / 2);
    } else {
      ctx.fillStyle = '#64748B';
      ctx.fillText(truncateText(ctx, worker.remark || '-', cols[5].width - 16), cellX + 12, rowY + rowHeight / 2);
    }
  });

  // Table Outer Frame & Vertical Dividers
  const tableTotalHeight = 36 + workers.length * rowHeight;
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.strokeRect(tableX + 0.5, tableTopY + 0.5, tableWidth - 1, tableTotalHeight - 1);

  // Vertical lines between columns inside table rows
  let divX = tableX;
  cols.slice(0, -1).forEach(col => {
    divX += col.width;
    ctx.beginPath();
    ctx.strokeStyle = '#E2E8F0';
    ctx.moveTo(divX + 0.5, rowsStartY);
    ctx.lineTo(divX + 0.5, rowsStartY + workers.length * rowHeight);
    ctx.stroke();
  });

  // 7. Footer Notes & Sign-off
  const footerY = rowsStartY + workers.length * rowHeight + 18;

  // Top divider line for footer
  ctx.beginPath();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.moveTo(tableX, footerY);
  ctx.lineTo(tableX + tableWidth, footerY);
  ctx.stroke();

  // Left side notes
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#475569';
  ctx.font = "bold 11px 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText('※ 안내사항', tableX, footerY + 10);

  ctx.fillStyle = '#64748B';
  ctx.font = "500 10.5px 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText('• 본 명단은 현장 출입점검 사전 관리용 안내 자료입니다.', tableX, footerY + 26);
  ctx.fillText('• 미확인 인원은 현장 출입 전 신속하게 점검 확인을 완료하여 주시기 바랍니다.', tableX, footerY + 42);

  // Right side sign-off
  ctx.textAlign = 'right';
  ctx.fillStyle = '#334155';
  ctx.font = "bold 11px 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`발송 담당자: ${checkerName || '점검자'}`, tableX + tableWidth, footerY + 14);

  ctx.fillStyle = '#94A3B8';
  ctx.font = "500 10px 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText('현장 안전관리 출입점검팀', tableX + tableWidth, footerY + 30);

  return canvas;
}
