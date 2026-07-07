import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (name: string, pw: string, autoLogin?: boolean) => Promise<void>;
  isLoading: boolean;
}

export default function Login({ onLogin, isLoading }: LoginProps) {
  const [mode, setMode] = useState<'USER' | 'ADMIN'>('USER');
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw) return alert('비밀번호를 입력하세요.');
    onLogin(mode === 'USER' ? name : '관리자', pw, false);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#F2F2F7] p-4 relative overflow-y-auto">
      <div className="w-full max-w-[24rem] z-10">
        <div className="text-center mb-8">
          <p className="text-[#007AFF] font-bold text-xs tracking-widest mb-1">HD HYUNDAI</p>
          <h1 className="text-xl font-black text-[#1C1C1E] leading-tight tracking-tight">
            HD현대삼호 사내협력사<br />
            <span className="text-2xl">출입 점검 시스템</span>
          </h1>
        </div>

        <div className="bg-white p-6 rounded-[20px] shadow-sm">
          <div className="flex bg-[#e3e3e8] p-[2px] rounded-lg mb-6">
            <button 
              type="button"
              onClick={() => { setMode('USER'); setPw('1234'); }} 
              className={cn(
                "flex-1 py-3 rounded-[6px] text-[13px] font-semibold transition",
                mode === 'USER' ? "bg-white shadow text-slate-800" : "text-slate-400"
              )}
            >
              점검자
            </button>
            <button 
              type="button"
              onClick={() => { setMode('ADMIN'); setPw('9999'); }} 
              className={cn(
                "flex-1 py-3 rounded-[6px] text-[13px] font-semibold transition",
                mode === 'ADMIN' ? "bg-white shadow text-slate-800" : "text-slate-400"
              )}
            >
              관리자
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'USER' && (
              <div className="mb-3">
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#F2F2F7] border-0 rounded-[12px] px-4 py-3.5 text-[15px] font-medium outline-none focus:border-blue-500 transition" 
                  placeholder="성명" 
                />
              </div>
            )}

            <div className="mb-6">
              <input 
                type="password" 
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="w-full bg-[#F2F2F7] border-0 rounded-[12px] px-4 py-3.5 text-[15px] font-medium outline-none focus:border-blue-500 transition" 
                placeholder="비밀번호" 
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-[#007AFF] text-white hover:bg-[#0056b3] transition-colors py-3.5 rounded-[14px] font-semibold text-[17px] shadow-sm flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
              접속하기
            </button>
          </form>
        </div>
        
        <div className="text-center mt-10 opacity-40">
          <p className="text-[#8E8E93] text-[0.6rem] font-bold tracking-widest">MADE BY 이호민</p>
        </div>
      </div>
    </div>
  );
}
