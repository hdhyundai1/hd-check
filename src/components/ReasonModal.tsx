import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Worker } from '../types';

interface ReasonModalProps {
  worker: Worker | null;
  onClose: () => void;
  onSave: (rowIndex: number, status: string, remark: string) => Promise<void> | void;
}

const REASONS = [
  { id: '산재', classes: 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100', activeClass: 'ring-orange-400', type: 'range' },
  { id: '연차', classes: 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100', activeClass: 'ring-blue-400', type: 'single' },
  { id: '휴가', classes: 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100', activeClass: 'ring-emerald-400', type: 'range' },
  { id: '병가', classes: 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100', activeClass: 'ring-purple-400', type: 'range' },
  { id: '퇴사', classes: 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100', activeClass: 'ring-red-400', type: 'single' },
  { id: '기타', classes: 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100', activeClass: 'ring-slate-400', type: 'range_text' },
];

export default function ReasonModal({ worker, onClose, onSave }: ReasonModalProps) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [singleDate, setSingleDate] = useState('');

  useEffect(() => {
    if (worker) {
      setSelectedCategory('');
      setReasonText('');
      setStartDate('');
      setEndDate('');
      setSingleDate('');
    }
  }, [worker]);

  if (!worker) return null;

  const handleReasonSelect = (cat: string) => {
    setSelectedCategory(cat);
    setReasonText('');
    setStartDate('');
    setEndDate('');
    setSingleDate('');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
  };

  const handleCommitReason = () => {
    if (!selectedCategory) return alert('사유를 선택하세요');

    const selectedReasonDef = REASONS.find(r => r.id === selectedCategory);
    let finalReason = '';

    if (selectedReasonDef?.type === 'range') {
      if (!startDate && !endDate) return alert('날짜를 선택하세요.');
      if (startDate && endDate) {
        finalReason = `${selectedCategory} (${formatDate(startDate)} ~ ${formatDate(endDate)})`;
      } else if (startDate) {
        finalReason = `${selectedCategory} (${formatDate(startDate)})`;
      } else {
        finalReason = `${selectedCategory} (${formatDate(endDate)})`;
      }
    } else if (selectedReasonDef?.type === 'single') {
      if (!singleDate) return alert('날짜를 선택하세요.');
      finalReason = `${selectedCategory} (${formatDate(singleDate)})`;
    } else if (selectedReasonDef?.type === 'range_text') {
      const text = reasonText.trim();
      if (!text) return alert('사유를 입력하세요.');
      
      if (!startDate && !endDate) return alert('날짜를 선택하세요.');
      
      if (startDate && endDate) {
        finalReason = `${text} (${formatDate(startDate)} ~ ${formatDate(endDate)})`;
      } else if (startDate) {
        finalReason = `${text} (${formatDate(startDate)})`;
      } else {
        finalReason = `${text} (${formatDate(endDate)})`;
      }
    }

    onSave(worker.rowIndex, '부재중 확인', finalReason);
    onClose();
  };

  const activeReasonDef = REASONS.find(r => r.id === selectedCategory);

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center sm:p-4 transition-opacity duration-300 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-[26rem] rounded-t-[20px] sm:rounded-[20px] p-6 shadow-2xl pb-8 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-[20px] text-[#1C1C1E] tracking-tight">부재중 사유 입력 - {worker.name}</h3>
          <button onClick={onClose} className="text-slate-400 text-xl p-2 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-xs font-bold text-slate-400 mb-2">미확인(결근) 사유 선택</p>
        
        <div className="grid grid-cols-2 min-[350px]:grid-cols-3 gap-2 mb-4">
          {REASONS.map(r => {
            const isActive = selectedCategory === r.id;
            return (
              <button 
                key={r.id}
                onClick={() => handleReasonSelect(r.id)}
                className={cn(
                  "py-3 rounded-lg text-xs font-semibold transition-all border",
                  r.classes,
                  isActive && `ring-2 ring-offset-1 transform scale-[0.98] border-transparent font-black ${r.activeClass}`
                )}
              >
                {r.id}
              </button>
            )
          })}
        </div>
        
        {activeReasonDef?.type === 'range' && (
          <div className="flex items-center gap-2 mb-5">
            <input 
              type="date"
              value={startDate}
              
              onChange={e => setStartDate(e.target.value)}
              className="flex-1 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-slate-800 bg-slate-50 transition"
            />
            <span className="font-black text-slate-400">~</span>
            <input 
              type="date"
              value={endDate}
              
              onChange={e => setEndDate(e.target.value)}
              className="flex-1 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-slate-800 bg-slate-50 transition"
            />
          </div>
        )}

        {activeReasonDef?.type === 'single' && (
          <div className="mb-5">
            <input 
              type="date"
              value={singleDate}
              
              onChange={e => setSingleDate(e.target.value)}
              className="w-full border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-slate-800 bg-slate-50 transition"
            />
          </div>
        )}

        {activeReasonDef?.type === 'range_text' && (
          <div className="flex flex-col gap-2 mb-5">
            <input 
              type="text" 
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              className="w-full border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-slate-800 bg-slate-50 placeholder:text-slate-400 transition" 
              placeholder="기타 사유를 입력하세요" 
            />
            <div className="flex items-center gap-2">
              <input 
                type="date"
                value={startDate}
                
                onChange={e => setStartDate(e.target.value)}
                className="flex-1 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-slate-800 bg-slate-50 transition"
              />
              <span className="font-black text-slate-400">~</span>
              <input 
                type="date"
                value={endDate}
                
                onChange={e => setEndDate(e.target.value)}
                className="flex-1 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-slate-800 bg-slate-50 transition"
              />
            </div>
          </div>
        )}
        
        <div className="flex flex-col gap-2">
          <button 
            onClick={handleCommitReason} 
            className="w-full py-4 rounded-xl font-extrabold text-white bg-[#007AFF] hover:bg-[#0056b3] active:scale-95 text-white font-semibold transition text-sm"
          >
            저장하기 (부재중 처리)
          </button>
          
          {worker.status && (
            <button 
              onClick={() => {
                onSave(worker.rowIndex, '확인', '');
                onClose();
              }} 
              className="w-full py-4 rounded-xl font-semibold text-[#007AFF] bg-white border border-[#007AFF] hover:bg-[#007AFF]/10 active:scale-95 transition text-sm"
            >
              정상출근으로 변경
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
