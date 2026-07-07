import React, { useState, useEffect, useMemo } from 'react';
import { fetchWorkersApi, fetchAvailableRoundsApi, subscribeWorkersApi } from '../lib/api';
import { BarChart3, Users, CheckCircle2, UserX, Clock, X, Loader2 } from 'lucide-react';
import { Worker } from '../types';
import { cn } from '../lib/utils';

interface DashboardModalProps {
  workerList: Worker[];
  roundId: string;
  onClose: () => void;
}

export default function DashboardModal({ workerList: initialWorkerList, roundId: initialRoundId, onClose }: DashboardModalProps) {
  const [selectedRoundId, setSelectedRoundId] = useState(initialRoundId);
  const [currentWorkerList, setCurrentWorkerList] = useState<Worker[]>(initialWorkerList);
  const [availableRounds, setAvailableRounds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetchAvailableRoundsApi().then(rounds => {
      if (isMounted) {

        setAvailableRounds(rounds);
      }
    });
    return () => { isMounted = false; };
  }, [initialRoundId]);

  const roundOptions = useMemo(() => {
    // Group by year and sort ascending to determine '차수' (index)
    const yearGroups: Record<string, string[]> = {};
    availableRounds.forEach(r => {
      const y = r.substring(0, 4);
      if (!yearGroups[y]) yearGroups[y] = [];
      yearGroups[y].push(r);
    });
    
    const options: { id: string, label: string }[] = [];
    Object.keys(yearGroups).forEach(y => {
      const sorted = yearGroups[y].sort();
      sorted.forEach((r, idx) => {
        const fromDateStr = r.split('_')[0];
        const d = new Date(fromDateStr);
        if (isNaN(d.getTime())) return;
        const yy = String(d.getFullYear()).slice(-2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        options.push({
          id: r,
          label: `${yy}년 ${idx + 1}차수 (${mm}월${dd}일)`
        });
      });
    });
    
    // Return options sorted descending (newest first)
    return options.sort((a, b) => b.id.localeCompare(a.id));
  }, [availableRounds]);


  useEffect(() => {
    if (!selectedRoundId) return;
    
    setIsLoading(true);
    const unsubscribe = subscribeWorkersApi(selectedRoundId, (list) => {
      setCurrentWorkerList(list);
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, [selectedRoundId]);

  const stats = useMemo(() => {
    const total = currentWorkerList.length;
    const checkedWorkers = currentWorkerList.filter(w => w.status && w.status.trim() === '확인');
    const absentWorkers = currentWorkerList.filter(w => w.status && w.status.trim() !== '확인');
    
    // 점검자 (lastChecker or checker) of checked/absent
    const processedWorkers = currentWorkerList.filter(w => !!w.status);
    
    const checkerSet = new Set<string>();
    processedWorkers.forEach(w => {
      const checker = w.lastChecker || w.checker;
      if (checker) checkerSet.add(checker);
    });
    
    const checkerCount = checkerSet.size;
    const processedCount = processedWorkers.length;
    const confirmCount = checkedWorkers.length;
    const absentCount = absentWorkers.length;
    
    const avgConfirmPerChecker = checkerCount > 0 ? (confirmCount / checkerCount).toFixed(1) : '0';
    
    // 부재중 사유별 통계
    const reasonCounts: Record<string, number> = {};
    const STANDARD_REASONS = ['산재', '연차', '휴가', '병가', '퇴사', '기타'];
    absentWorkers.forEach(w => {
      if (w.remark) {
        let category = w.remark.split(' ')[0]; // '휴가', '연차', etc.
        if (!STANDARD_REASONS.includes(category)) {
          category = '기타';
        }
        reasonCounts[category] = (reasonCounts[category] || 0) + 1;
      } else {
        reasonCounts['미기재'] = (reasonCounts['미기재'] || 0) + 1;
      }
    });

    return {
      total,
      checkerCount,
      processedCount,
      confirmCount,
      absentCount,
      avgConfirmPerChecker,
      reasonCounts
    };
  }, [currentWorkerList]);

  const formattedRound = useMemo(() => {
    const opt = roundOptions.find(o => o.id === selectedRoundId);
    return opt ? opt.label : selectedRoundId;
  }, [selectedRoundId, roundOptions]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#F2F2F7] w-full max-w-lg rounded-[20px] shadow-2xl relative animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-white px-6 py-5 border-b border-gray-200 flex justify-between items-center shrink-0" style={{ height: "67px" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-[#1C1C1E] tracking-tight leading-none mb-2">
                데이터 분석 대시보드
              </h2>
              <div className="flex items-center gap-2">
                {availableRounds.length > 0 ? (
                  <select 
                    value={selectedRoundId}
                    onChange={e => setSelectedRoundId(e.target.value)}
                    className="bg-slate-100 text-xs font-semibold text-slate-700 border-none rounded py-1 px-2 outline-none cursor-pointer"
                    style={{ width: "128px", height: "28px" }}
                  >
                    <option value={selectedRoundId} disabled className="hidden">현재: {selectedRoundId.replace('_', ' ~ ')}</option>
                    {roundOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded">명단 없음</span>
                )}
                {isLoading && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6" style={{ paddingTop: "12px" }}>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col items-center text-center" style={{ height: "80px", paddingTop: "10px", paddingBottom: "10px" }}>
              <span className="text-[11px] font-black tracking-widest text-slate-400 mb-1">총 인원</span>
              <span className="text-3xl font-black text-slate-800">{stats.total}</span>
            </div>
            <div className="bg-blue-500 p-5 rounded-2xl shadow-sm flex flex-col items-center text-center" style={{ height: "80px", paddingTop: "10px", paddingBottom: "10px" }}>
              <span className="text-[11px] font-black tracking-widest text-blue-200 mb-1">점검 인원</span>
              <span className="text-3xl font-black text-white">{stats.processedCount}</span>
            </div>
            <div className="bg-emerald-500 p-5 rounded-2xl shadow-sm flex flex-col items-center text-center" style={{ height: "80px", paddingTop: "10px", paddingBottom: "10px" }}>
              <span className="text-[11px] font-black tracking-widest text-emerald-200 mb-1">확인 인원</span>
              <span className="text-3xl font-black text-white">{stats.confirmCount}</span>
            </div>
            <div className="bg-red-500 p-5 rounded-2xl shadow-sm flex flex-col items-center text-center" style={{ height: "80px", paddingTop: "10px", paddingBottom: "10px" }}>
              <span className="text-[11px] font-black tracking-widest text-red-200 mb-1">부재중 인원</span>
              <span className="text-3xl font-black text-white">{stats.absentCount}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5" style={{ marginLeft: "0px", marginTop: "-11px", marginBottom: "7px", minHeight: "135px", paddingTop: "10px", paddingBottom: "10px" }}>
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              점검자 활동 지표
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-[13px] font-semibold text-slate-500">참여 점검자 수</span>
                <span className="text-[15px] font-bold text-slate-800">{stats.checkerCount} 명</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] font-semibold text-slate-500">점검자 1인당 평균 확인</span>
                <span className="text-[15px] font-bold text-slate-800">{stats.avgConfirmPerChecker} 명</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 flex flex-col" style={{ marginLeft: "0px", marginTop: "6px", marginBottom: "7px", minHeight: "145px", maxHeight: "400px", paddingTop: "10px", paddingBottom: "10px" }}>
            <h3 className="text-sm font-bold text-slate-800 mb-2 shrink-0 flex items-center gap-2">
              <UserX className="w-4 h-4 text-red-500" />
              부재중 사유 상세 ({stats.absentCount}명)
            </h3>
            
            {Object.keys(stats.reasonCounts).length > 0 ? (
              <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 pb-1">
                {Object.entries(stats.reasonCounts)
                  .sort((a: [string, any], b: [string, any]) => (b[1] as number) - (a[1] as number))
                  .map(([reason, count]) => {
                    const percentage = Math.round(((count as number) / stats.absentCount) * 100);
                    return (
                      <div key={reason} className="group">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[13px] font-bold text-slate-700">{reason}</span>
                          <span className="text-[13px] font-bold text-slate-500">{count}명 <span className="text-slate-400 font-medium text-[11px]">({percentage}%)</span></span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-red-400 h-full rounded-full" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                <p className="text-[13px] font-semibold">부재중 인원이 없습니다.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
