import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Download, Share2, Copy, Check, Camera, Loader2, FileText, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { Worker } from '../types';
import { renderWorkerListToCanvas } from '../lib/captureRenderer';

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  workerList: Worker[];
  roundLabel: string;
  currentComp: string;
  currentTab: 'all' | 'un' | 'ok';
  stats: { total: number; ok: number; no: number };
  checkerName: string;
}

const PAGE_SIZE = 35; // 35 workers per page for optimal KakaoTalk readability

export default function CaptureModal({
  isOpen,
  onClose,
  workerList,
  roundLabel,
  currentComp,
  currentTab,
  stats,
  checkerName,
}: CaptureModalProps) {
  // Page mode: 'all' for single full image, or a number 0, 1, 2... for paginated view
  const [selectedPageIndex, setSelectedPageIndex] = useState<'all' | number>('all');
  const [currentImageData, setCurrentImageData] = useState<string | null>(null);
  const [currentImageBlob, setCurrentImageBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [textCopySuccess, setTextCopySuccess] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const tabTitle = currentTab === 'un' ? '미확인' : currentTab === 'ok' ? '확인완료' : '전체';
  const companyTitle = currentComp === 'ALL' ? '전체 업체' : currentComp;

  // Format current date and time
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateCompact = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  // Calculate pagination pages
  const totalPages = Math.ceil(workerList.length / PAGE_SIZE);
  const isPagingApplicable = workerList.length > PAGE_SIZE;

  // Determine current slice of workers to render
  const currentWorkersSlice = useMemo(() => {
    if (selectedPageIndex === 'all' || !isPagingApplicable) {
      return {
        workers: workerList,
        startIndex: 0,
        pageInfo: undefined,
      };
    }
    const start = selectedPageIndex * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, workerList.length);
    return {
      workers: workerList.slice(start, end),
      startIndex: start,
      pageInfo: {
        current: selectedPageIndex + 1,
        total: totalPages,
      },
    };
  }, [workerList, selectedPageIndex, isPagingApplicable, totalPages]);

  const filename = useMemo(() => {
    const pageSuffix = selectedPageIndex === 'all' 
      ? '_전체' 
      : `_P${selectedPageIndex + 1}of${totalPages}`;
    return `출입점검_${companyTitle.replace(/\s+/g, '_')}_${tabTitle}명단${pageSuffix}_${dateCompact}.png`;
  }, [companyTitle, tabTitle, selectedPageIndex, totalPages, dateCompact]);

  // Generate canvas-based image
  const generateCurrentImage = useCallback(async () => {
    if (!workerList || workerList.length === 0) return;
    setIsGenerating(true);
    setShareStatus(null);

    try {
      // Yield to let React show loading state
      await new Promise(r => setTimeout(r, 40));

      const canvas = renderWorkerListToCanvas({
        workers: currentWorkersSlice.workers,
        totalWorkerCount: workerList.length,
        startIndex: currentWorkersSlice.startIndex,
        roundLabel,
        companyTitle,
        tabTitle,
        currentTab,
        stats,
        checkerName,
        dateStr,
        pageInfo: currentWorkersSlice.pageInfo,
      });

      const dataUrl = canvas.toDataURL('image/png');
      setCurrentImageData(dataUrl);

      canvas.toBlob((blob) => {
        if (blob) {
          setCurrentImageBlob(blob);
        }
      }, 'image/png');
    } catch (err: any) {
      console.error('Canvas capture generation error:', err);
      alert('명단 캡쳐 이미지 생성 중 오류가 발생했습니다: ' + (err?.message || String(err)));
    } finally {
      setIsGenerating(false);
    }
  }, [
    workerList,
    currentWorkersSlice,
    roundLabel,
    companyTitle,
    tabTitle,
    currentTab,
    stats,
    checkerName,
    dateStr,
  ]);

  // Regenerate when modal opens or page selection changes
  useEffect(() => {
    if (isOpen) {
      generateCurrentImage();
    } else {
      setCopySuccess(false);
      setTextCopySuccess(false);
      setShareStatus(null);
    }
  }, [isOpen, selectedPageIndex, generateCurrentImage]);

  // Share via Web Share API
  const handleShare = async () => {
    if (!currentImageBlob) return;
    const file = new File([currentImageBlob], filename, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `[출입점검] ${companyTitle} ${tabTitle} 명단`,
          text: `[출입점검 ${tabTitle} 명단 안내]\n- 업체: ${companyTitle}\n- 인원: 총 ${(workerList.length || 0).toLocaleString()}명\n- 차수: ${roundLabel}\n상세 명단 캡쳐 이미지를 전송합니다.`,
        });
        setShareStatus('공유가 완료되었습니다.');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
          handleDownload();
        }
      }
    } else {
      // Fallback: Copy to clipboard or download
      handleCopyToClipboard();
    }
  };

  // Copy Image to Clipboard
  const handleCopyToClipboard = async () => {
    if (!currentImageBlob) return;
    try {
      if (navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({
            'image/png': currentImageBlob,
          }),
        ]);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
      } else {
        throw new Error('ClipboardItem not supported');
      }
    } catch (err) {
      console.warn('Clipboard write failed, downloading instead:', err);
      handleDownload();
      alert('클립보드 이미지 복사를 지원하지 않는 브라우저입니다. 이미지가 다운로드 폴더에 저장되었습니다. 카카오톡 창에 드래그하거나 첨부해주세요.');
    }
  };

  // Download Image File
  const handleDownload = () => {
    if (!currentImageData) return;
    const link = document.createElement('a');
    link.href = currentImageData;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download all pages if paginated
  const handleDownloadAllPages = async () => {
    if (!isPagingApplicable) {
      handleDownload();
      return;
    }
    
    try {
      for (let p = 0; p < totalPages; p++) {
        const start = p * PAGE_SIZE;
        const end = Math.min(start + PAGE_SIZE, workerList.length);
        const pageCanvas = renderWorkerListToCanvas({
          workers: workerList.slice(start, end),
          totalWorkerCount: workerList.length,
          startIndex: start,
          roundLabel,
          companyTitle,
          tabTitle,
          currentTab,
          stats,
          checkerName,
          dateStr,
          pageInfo: { current: p + 1, total: totalPages },
        });

        const pDataUrl = pageCanvas.toDataURL('image/png');
        const pLink = document.createElement('a');
        pLink.href = pDataUrl;
        pLink.download = `출입점검_${companyTitle.replace(/\s+/g, '_')}_${tabTitle}명단_P${p + 1}of${totalPages}_${dateCompact}.png`;
        document.body.appendChild(pLink);
        pLink.click();
        document.body.removeChild(pLink);
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (err) {
      console.error('Batch download failed', err);
    }
  };

  // Copy plain text list for messenger
  const handleCopyTextList = () => {
    const lines = [
      `[출입점검 ${tabTitle} 명단 안내]`,
      `• 업체: ${companyTitle}`,
      `• 점검차수: ${roundLabel}`,
      `• 인원: 총 ${(workerList.length || 0).toLocaleString()}명`,
      `• 기준일시: ${dateStr}`,
      `------------------------`,
      ...workerList.map((w, idx) => {
        const statusText = w.status ? (w.status === '확인' ? '확인완료' : `${w.status}${w.remark ? `(${w.remark})` : ''}`) : '미확인';
        return `${idx + 1}. ${w.name} (${w.dob || '-'}) - ${statusText}`;
      }),
      `------------------------`,
      `※ 신속한 출입점검 확인 부탁드립니다. (담당자: ${checkerName || '점검자'})`,
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setTextCopySuccess(true);
      setTimeout(() => setTextCopySuccess(false), 3000);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                명단 캡쳐 & 카톡/SNS 발송
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  총 {(workerList.length || 0).toLocaleString()}명
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                내용 겹침이나 하단 짤림 없이 100% 온전하게 캡쳐되었습니다.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-100/70 space-y-3.5">
          
          {/* Page Tabs (if list exceeds PAGE_SIZE) */}
          {isPagingApplicable && (
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>명단 보기 방식:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedPageIndex('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedPageIndex === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  전체 1장 (통캡쳐 {(workerList.length || 0).toLocaleString()}명)
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPageIndex(idx)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedPageIndex === idx
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {idx + 1}페이지 ({idx * PAGE_SIZE + 1}~{Math.min((idx + 1) * PAGE_SIZE, workerList.length)}번)
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Image Preview Box */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col items-center">
            <div className="w-full flex justify-between items-center px-1 py-1 mb-1 text-[11px] text-slate-500 font-medium">
              <span className="font-bold text-slate-700">
                캡쳐 미리보기 ({companyTitle} / {tabTitle} {(workerList.length || 0).toLocaleString()}명
                {selectedPageIndex !== 'all' && ` - ${Number(selectedPageIndex) + 1}/${totalPages}페이지`}
                )
              </span>
              <div className="flex items-center gap-2">
                {selectedPageIndex !== 'all' && (
                  <div className="flex items-center gap-1 text-slate-400">
                    <button
                      onClick={() => setSelectedPageIndex(prev => (typeof prev === 'number' && prev > 0 ? prev - 1 : prev))}
                      disabled={selectedPageIndex === 0}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                      title="이전 페이지"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-bold text-slate-600">
                      {Number(selectedPageIndex) + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setSelectedPageIndex(prev => (typeof prev === 'number' && prev < totalPages - 1 ? prev + 1 : prev))}
                      disabled={selectedPageIndex === totalPages - 1}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                      title="다음 페이지"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <button 
                  onClick={generateCurrentImage}
                  className="text-blue-600 hover:underline flex items-center gap-1 font-bold ml-1 cursor-pointer"
                >
                  새로고침
                </button>
              </div>
            </div>
            
            {isGenerating ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-600 w-full">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="font-bold text-sm">고화질 명단 캡쳐 이미지 생성 중...</p>
                <p className="text-xs text-slate-400">내용 겹침 및 하단 짤림 없이 정밀하게 렌더링하고 있습니다.</p>
              </div>
            ) : currentImageData ? (
              <div className="max-h-[380px] overflow-y-auto w-full border border-slate-200 rounded-lg shadow-inner bg-slate-50 p-2 flex justify-center">
                <img 
                  src={currentImageData} 
                  alt="명단 캡쳐" 
                  className="max-w-full h-auto object-contain rounded shadow-xs" 
                />
              </div>
            ) : (
              <div className="py-12 text-slate-400 text-sm">이미지를 불러오는 중...</div>
            )}
          </div>

          {shareStatus && (
            <p className="text-center text-xs text-emerald-600 font-bold bg-emerald-50 py-1.5 rounded-lg border border-emerald-200">
              {shareStatus}
            </p>
          )}

        </div>

        {/* Modal Action Buttons Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row gap-2.5 justify-between items-center">
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyTextList}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              title="텍스트 명단 복사 (카톡 텍스트 메시지용)"
            >
              {textCopySuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <FileText className="w-3.5 h-3.5 text-slate-500" />}
              <span>{textCopySuccess ? '텍스트 복사됨!' : '텍스트 복사'}</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={!currentImageData || isGenerating}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
              title="이미지 파일 다운로드"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>이미지 저장</span>
            </button>

            {isPagingApplicable && (
              <button
                onClick={handleDownloadAllPages}
                disabled={!currentImageData || isGenerating}
                className="hidden md:inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                title="모든 분할 페이지 일괄 다운로드"
              >
                <span>전체({totalPages}P) 저장</span>
              </button>
            )}
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyToClipboard}
              disabled={!currentImageData || isGenerating}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold text-xs shadow transition-all disabled:opacity-50 cursor-pointer"
              title="클립보드에 이미지 복사 (카카오톡 채팅방에서 Ctrl+V 붙여넣기)"
            >
              {copySuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>복사 완료! (Ctrl+V)</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>클립보드 복사</span>
                </>
              )}
            </button>

            <button
              onClick={handleShare}
              disabled={!currentImageData || isGenerating}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#FEE500] hover:bg-[#FDD800] text-[#191919] font-black text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              title="카카오톡 또는 모바일 SNS 공유"
            >
              <Share2 className="w-4 h-4" />
              <span>카카오톡 / SNS 공유</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
