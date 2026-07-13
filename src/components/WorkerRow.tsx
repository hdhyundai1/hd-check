import React from 'react';
import { Worker } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface WorkerRowProps {
  key?: React.Key;
  item: Worker;
  currentTab: 'all' | 'un' | 'ok';
  showCompany: boolean;
  onSave: (rowIndexOrId: number | string, status: string, remark: string) => Promise<void> | void;
  onOpenModal: (worker: Worker) => void;
}

export default function WorkerRow({ item, currentTab, showCompany, onSave, onOpenModal, ref }: WorkerRowProps & { ref?: React.Ref<HTMLDivElement> }) {
  const checkVal = String(item.targetCheck || '').trim().toLowerCase();
  const isTarget = ['o', 'ㅇ', '0', '○', 'v'].includes(checkVal);
  
  const [confirmState, setConfirmState] = React.useState(false);
  const confirmTimeoutRef = React.useRef<NodeJS.Timeout>();

  const handleNormalAttendance = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmState) {
      setConfirmState(true);
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = setTimeout(() => {
        setConfirmState(false);
      }, 3000);
    }
  };

  const confirmNormalAttendance = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    setConfirmState(false);
    onSave(item.id || item.rowIndex, '확인', '');
  };

  return (
    <div 
      ref={ref}
      className={cn(
        "px-5 py-3.5 border-b border-gray-100/80 active:bg-gray-100 transition-colors",
        item.status?.trim() === '확인' ? "bg-blue-50/30" : (item.status && item.status.trim() !== '확인' ? "bg-red-50/20" : "")
      )}
    >
      <div className="flex w-full max-w-5xl mx-auto justify-between items-center gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className={cn(
          "text-[17px] font-semibold truncate",
          isTarget ? "text-[#007AFF]" : "text-[#1C1C1E]"
        )}>
          {item.name}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[13px] text-[#8E8E93] shrink-0">
            {item.dob}
          </span>
          {!!item.status && (
            <span className={cn(
              "text-[11px] px-2 py-0.5 rounded-full font-medium text-white shrink-0 ml-1",
              item.status.trim() === '확인' ? 'bg-[#34C759]' : 'bg-[#FF3B30]'
            )}>
              {item.status}
            </span>
          )}
        </div>
        
        {item.status && item.status.trim() !== '확인' && item.remark && (
          <span className="text-[13px] text-[#FF3B30] font-medium truncate max-w-[150px] md:max-w-[200px] ml-2 hidden md:block">
            사유: {item.remark}
          </span>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        {!item.status ? (
          <>
            <div className="relative flex items-center justify-center">
              <button 
                onClick={handleNormalAttendance} 
                className="bg-[#007AFF] text-white font-semibold text-[13px] px-4 py-1.5 rounded-full active:opacity-70 transition-all shrink-0"
              >
                정상출근
              </button>
              {confirmState && (
                <button 
                  onClick={confirmNormalAttendance}
                  className="absolute inset-0 w-full h-full flex items-center justify-center bg-[#34C759] text-white font-bold text-[13px] rounded-full shadow-lg active:opacity-70 z-10 animate-in fade-in zoom-in-95 duration-150"
                >
                  확실한겨?
                </button>
              )}
            </div>
            <button 
              onClick={() => onOpenModal(item)} 
              className="bg-[#FF3B30]/10 text-[#FF3B30] font-semibold text-[13px] px-4 py-1.5 rounded-full active:opacity-70 transition-all shrink-0"
            >
              부재중
            </button>
          </>
        ) : (
          <button 
            onClick={() => onOpenModal(item)} 
            className="bg-gray-100 text-gray-700 font-medium text-[13px] px-4 py-1.5 rounded-full active:opacity-70 transition-all shrink-0"
          >
            수정
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
