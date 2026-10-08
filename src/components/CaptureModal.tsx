import React, { useState, useRef, useEffect } from 'react';
import { X, Download, Share2, Copy, Check, Camera, Loader2, FileText, AlertCircle, Sparkles } from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import { Worker } from '../types';

function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  workerList: Worker[];
  roundLabel: string;
  currentComp: string;
  currentTab: 'all' | 'un' | 'ok';
  stats: { total: number; ok: number; no: number };
  checkerName: string;
  initialImageData?: string | null;
  initialBlob?: Blob | null;
}

export default function CaptureModal({
  isOpen,
  onClose,
  workerList,
  roundLabel,
  currentComp,
  currentTab,
  stats,
  checkerName,
  initialImageData,
  initialBlob,
}: CaptureModalProps) {
  const [imageData, setImageData] = useState<string | null>(initialImageData || null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(initialBlob || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [textCopySuccess, setTextCopySuccess] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const tabTitle = currentTab === 'un' ? '미확인' : currentTab === 'ok' ? '확인완료' : '전체';
  const companyTitle = currentComp === 'ALL' ? '전체 업체' : currentComp;
  
  // Format current date and time
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `출입점검_${companyTitle.replace(/\s+/g, '_')}_${tabTitle}명단_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.png`;

  // Auto-generate if opened without initial image
  useEffect(() => {
    if (isOpen) {
      if (initialImageData && initialBlob) {
        setImageData(initialImageData);
        setImageBlob(initialBlob);
      } else {
        generateImage();
      }
    } else {
      setCopySuccess(false);
      setTextCopySuccess(false);
      setShareStatus(null);
    }
  }, [isOpen, initialImageData, initialBlob]);

  const generateImage = async () => {
    if (!printAreaRef.current) return;
    setIsGenerating(true);
    setShareStatus(null);

    try {
      // Wait for layout to be fully rendered
      await new Promise(r => setTimeout(r, 200));

      const dataUrl = await toPng(printAreaRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
      });

      setImageData(dataUrl);

      try {
        const blob = await toBlob(printAreaRef.current, {
          backgroundColor: '#ffffff',
          pixelRatio: 2,
          cacheBust: true,
        });
        if (blob) {
          setImageBlob(blob);
        } else {
          setImageBlob(dataURLtoBlob(dataUrl));
        }
      } catch {
        setImageBlob(dataURLtoBlob(dataUrl));
      }
    } catch (err: any) {
      console.error('Image capture error:', err);
      alert('이미지 캡쳐 중 오류가 발생했습니다: ' + (err?.message || String(err)));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!imageBlob) return;
    const file = new File([imageBlob], filename, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `[출입점검] ${companyTitle} ${tabTitle} 명단`,
          text: `[출입점검 ${tabTitle} 명단 안내]\n- 업체: ${companyTitle}\n- 대상 인원: ${(workerList.length || 0).toLocaleString()}명\n- 차수: ${roundLabel}\n상세 명단 캡쳐 이미지를 전송합니다.`,
        });
        setShareStatus('공유가 완료되었습니다.');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
          handleFallbackDownload();
        }
      }
    } else {
      // Fallback: Copy to clipboard or download
      handleCopyToClipboard();
    }
  };

  const handleCopyToClipboard = async () => {
    if (!imageBlob) return;
    try {
      if (navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({
            'image/png': imageBlob,
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
      alert('클립보드 복사를 지원하지 않는 브라우저입니다. 이미지가 다운로드되었습니다. 다운로드된 이미지를 카톡으로 전송해주세요.');
    }
  };

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
      `※ 신속한 출입점검 확인 부탁드립니다. (담당자: ${checkerName})`,
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setTextCopySuccess(true);
      setTimeout(() => setTextCopySuccess(false), 3000);
    });
  };

  const handleDownload = () => {
    if (!imageData) return;
    const link = document.createElement('a');
    link.href = imageData;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFallbackDownload = () => {
    handleDownload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Hidden container specifically styled for full DOM capture (never clipped by virtual scrolling) */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: '-9999px',
          width: '780px',
          backgroundColor: '#ffffff',
          color: '#1e293b',
          zIndex: -100,
          pointerEvents: 'none',
        }}
      >
        <div ref={printAreaRef} className="bg-white p-8 w-[780px] font-sans antialiased text-slate-900 border border-slate-200">
          {/* Header Banner */}
          <div className="border-b-2 border-slate-900 pb-5 mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="bg-slate-900 text-white text-[11px] font-black px-2.5 py-1 rounded tracking-wider uppercase">
                  현장 출입점검 관리시스템
                </span>
                <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded">
                  {roundLabel}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                발송일시: {dateStr}
              </span>
            </div>

            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              {currentTab === 'un' && <span className="text-red-600">🚨 [미확인]</span>}
              {currentTab === 'ok' && <span className="text-blue-600">✅ [확인완료]</span>}
              {currentTab === 'all' && <span className="text-slate-800">📋 [전체]</span>}
              <span>출입점검 대상자 명단</span>
              <span className="text-slate-500 text-lg font-bold">({companyTitle})</span>
            </h1>

            {/* Quick summary stats bar */}
            <div className="mt-4 grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">점검 대상</span>
                <span className="font-bold text-slate-800 text-sm">{companyTitle}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">명단 총원</span>
                <span className="font-extrabold text-blue-700 text-sm">{(workerList.length || 0).toLocaleString()} 명</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">업체 미확인 현황</span>
                <span className="font-extrabold text-red-600 text-sm">{(stats.no || 0).toLocaleString()} 명</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">점검 완료율</span>
                <span className="font-extrabold text-emerald-600 text-sm">
                  {stats.total > 0 ? Math.round((stats.ok / stats.total) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Full List Table */}
          <div className="mb-6">
            <table className="w-full text-left border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-800 text-white text-[12px] font-bold">
                  <th className="py-2.5 px-3 border border-slate-700 text-center w-12">No.</th>
                  <th className="py-2.5 px-3 border border-slate-700 w-28">성명</th>
                  <th className="py-2.5 px-3 border border-slate-700 w-28">생년월일</th>
                  <th className="py-2.5 px-3 border border-slate-700">소속 업체</th>
                  <th className="py-2.5 px-3 border border-slate-700 text-center w-28">출입점검 상태</th>
                  <th className="py-2.5 px-3 border border-slate-700">비고 / 사유</th>
                </tr>
              </thead>
              <tbody className="text-[12px]">
                {workerList.map((item, idx) => {
                  const isConfirmed = item.status?.trim() === '확인';
                  const isPending = !item.status;
                  const hasReason = item.status && !isConfirmed;

                  return (
                    <tr 
                      key={item.id || item.rowIndex || idx} 
                      className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}
                    >
                      <td className="py-2 px-3 border border-slate-300 text-center font-mono text-slate-500 font-semibold">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 border border-slate-300 font-bold text-slate-900 text-[13px]">
                        {item.name}
                      </td>
                      <td className="py-2 px-3 border border-slate-300 font-mono text-slate-600">
                        {item.dob || '-'}
                      </td>
                      <td className="py-2 px-3 border border-slate-300 text-slate-700 font-medium">
                        {item.company}
                      </td>
                      <td className="py-2 px-3 border border-slate-300 text-center">
                        {isPending && (
                          <span className="inline-block bg-red-100 text-red-700 border border-red-300 font-black px-2 py-0.5 rounded text-[11px]">
                            미확인
                          </span>
                        )}
                        {isConfirmed && (
                          <span className="inline-block bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded text-[11px]">
                            확인완료
                          </span>
                        )}
                        {hasReason && (
                          <span className="inline-block bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-0.5 rounded text-[11px]">
                            {item.status}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 border border-slate-300 text-slate-600 text-[11px]">
                        {item.remark || (isPending ? '출입 점검 필요' : '-')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Notes */}
          <div className="border-t-2 border-slate-200 pt-4 flex items-center justify-between text-[11px] text-slate-500">
            <div>
              <p className="font-bold text-slate-700">※ 안내사항</p>
              <p>• 본 명단은 현장 출입점검 사전 관리용 안내 자료입니다.</p>
              <p>• 미확인 인원은 현장 출입 전 신속하게 점검 확인을 완료하여 주시기 바랍니다.</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-700">발송 담당자: {checkerName || '점검자'}</p>
              <p className="text-[10px] text-slate-400">현장 안전관리 출입점검팀</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Visible Modal Dialog */}
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                명단 전체 캡쳐 & 카톡/SNS 발송
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  총 {(workerList.length || 0).toLocaleString()}명
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                화면 하단 스크롤 영역까지 누락 없이 전체 명단이 캡쳐되었습니다.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-100/70">
          {isGenerating ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-600">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="font-bold text-sm">전체 {(workerList.length || 0).toLocaleString()}명 고화질 캡쳐 이미지 생성 중...</p>
              <p className="text-xs text-slate-400">누락 방지를 위해 전체 명단을 렌더링하고 있습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* KakaoTalk Sharing Tip Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">업체 전달 꿀팁:</span>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-amber-800">
                    <li>
                      <strong>모바일(폰)</strong>: 아래 <strong>[카카오톡 / SNS 공유]</strong>를 누르면 카톡 채팅방을 바로 선택하여 보낼 수 있습니다.
                    </li>
                    <li>
                      <strong>PC</strong>: <strong>[클립보드 복사]</strong> 클릭 후 카카오톡 대화방에서 <strong>Ctrl + V</strong> (붙여넣기) 하시면 이미지가 즉시 전송됩니다.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Image Preview Box */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-2 flex flex-col items-center">
                <div className="w-full flex justify-between items-center px-2 py-1 mb-1 text-[11px] text-slate-500 font-medium">
                  <span>캡쳐 미리보기 ({companyTitle} / {tabTitle} {(workerList.length || 0).toLocaleString()}명)</span>
                  <button 
                    onClick={generateImage}
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    새로고침
                  </button>
                </div>
                
                {imageData ? (
                  <div className="max-h-[380px] overflow-y-auto w-full border border-slate-200 rounded-lg shadow-inner bg-slate-50 p-2 flex justify-center">
                    <img 
                      src={imageData} 
                      alt="명단 캡쳐" 
                      className="max-w-full h-auto object-contain rounded shadow-xs" 
                    />
                  </div>
                ) : (
                  <div className="py-12 text-slate-400 text-sm">이미지를 불러오는 중...</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Buttons Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row gap-2.5 justify-between items-center">
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyTextList}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              title="텍스트 명단 복사"
            >
              {textCopySuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <FileText className="w-3.5 h-3.5 text-slate-500" />}
              <span>{textCopySuccess ? '텍스트 복사됨!' : '텍스트 복사'}</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={!imageData || isGenerating}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors disabled:opacity-50"
              title="이미지 파일 다운로드"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>이미지 저장</span>
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyToClipboard}
              disabled={!imageData || isGenerating}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold text-xs shadow transition-all disabled:opacity-50"
              title="클립보드에 이미지 복사 (카톡에 바로 Ctrl+V 붙여넣기)"
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
              disabled={!imageData || isGenerating}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#FEE500] hover:bg-[#FDD800] text-[#191919] font-black text-xs shadow-md active:scale-95 transition-all disabled:opacity-50"
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
