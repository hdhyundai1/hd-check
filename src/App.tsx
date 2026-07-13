import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, LogOut, ChevronDown, Search, Loader2, Power, Zap, Settings, X, BarChart3 } from 'lucide-react';
import { UserInfo, Worker } from './types';
import { loginApi, saveStatusApi, fetchWorkersApi, fetchAvailableRoundsApi, subscribeWorkersApi } from './lib/api';
import { getChosung, cn } from './lib/utils';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import DashboardModal from './components/DashboardModal';
import WorkerRow from './components/WorkerRow';
import ReasonModal from './components/ReasonModal';
import { AnimatePresence } from 'motion/react';
import { Virtuoso } from 'react-virtuoso';

export default function App() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  
  const [currentTab, setCurrentTab] = useState<'all' | 'un' | 'ok'>('all');
  const [currentComp, setCurrentComp] = useState('ALL');
  const [search, setSearch] = useState('');
  
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  const [roundId, setRoundId] = useState('');
  
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch rounds on mount and select the appropriate one
  useEffect(() => {
    let isMounted = true;
    fetchAvailableRoundsApi().then(rounds => {
      if (!isMounted) return;
      if (rounds.length === 0) {
        const d = new Date();
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setRoundId(`${yy}-${mm}-${dd}`);
        return;
      }
      
      const d = new Date();
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const todayStr = `${yy}-${mm}-${dd}`;
      
      // Sort rounds by from date (descending)
      rounds.sort((a, b) => b.localeCompare(a));
      
      let selected = rounds[0]; // fallback to newest
      for (const r of rounds) {
        const fromDate = r.split('_')[0];
        if (fromDate <= todayStr) {
          selected = r;
          break;
        }
      }
      setRoundId(selected);
    });
    
    return () => { isMounted = false; };
  }, []);

  
  const [modalWorker, setModalWorker] = useState<Worker | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

  useEffect(() => {
    if (userInfo?.role && roundId) {
      const unsubscribe = subscribeWorkersApi(roundId, (list) => {
        setUserInfo(prev => prev ? { ...prev, list } : null);
      });
      return () => unsubscribe();
    }
  }, [roundId, userInfo?.role]);

  useEffect(() => {
    const savedInfo = localStorage.getItem('sh_user_info');
    if (savedInfo) {
      try {
        const parsed = JSON.parse(savedInfo);
        handleLogin(parsed.name, parsed.pw, true);
      } catch(e) { 
        localStorage.removeItem('sh_user_info'); 
      }
    }
  }, []);

  const handleLogin = async (name: string, pw: string, autoLogin = false) => {
    if (!autoLogin) setIsLoading(true);
    else setGlobalLoading(true);
    
    try {
      const json = await loginApi(name, pw);
      if (json.status === 'success') {
        // Fetch workers for current round
        const list = await fetchWorkersApi(roundId);
        setUserInfo({ role: json.role as any, name: json.name, list });
        localStorage.setItem('sh_user_info', JSON.stringify({ name, pw }));
      } else {
        if (!autoLogin) alert(json.message);
        localStorage.removeItem('sh_user_info');
      }
    } catch (e: any) {
      if (e?.message?.includes('Quota') || String(e).includes('Quota')) {
        if (!autoLogin) alert('데이터베이스 일일 무료 사용량을 초과했습니다. 내일 다시 시도해주세요.');
      } else {
        console.error(e);
        if (!autoLogin) alert('서버 연결 실패: ' + (e.message || ''));
      }
    } finally {
      setIsLoading(false);
      setGlobalLoading(false);
    }
  };

  const manualLogout = () => {
    localStorage.removeItem('sh_user_info');
    setUserInfo(null);
  };

  const syncData = () => {
    const savedInfo = localStorage.getItem('sh_user_info');
    if (savedInfo) {
      const parsed = JSON.parse(savedInfo);
      handleLogin(parsed.name, parsed.pw, true).then(() => {
        // Data synced
      });
    } else {
      setUserInfo(null);
    }
  };

  const handleSave = async (rowIndexOrId: number | string, status: string, remark = '') => {
    if (!userInfo) return;
    
    const target = (userInfo.list || []).find(d => 
      String(d.rowIndex) === String(rowIndexOrId) || d.id === rowIndexOrId
    );
    if (!target) return;
    
    // Optimistic update
    setUserInfo(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        list: (prev.list || []).map(item => 
          (String(item.rowIndex) === String(rowIndexOrId) || item.id === rowIndexOrId)
            ? { ...item, status, remark, lastChecker: prev.name }
            : item
        )
      };
    });

    // Clear the search query after saving status
    setSearch('');


    try {
      const now = new Date();
      const tzOffset = now.getTimezoneOffset() * 60000; 
      const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 19).replace('T', ' ');
      
      // Update checkDate in local state immediately for offline-first support
      setUserInfo(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          list: (prev.list || []).map(item => 
            (String(item.rowIndex) === String(rowIndexOrId) || item.id === rowIndexOrId)
              ? { ...item, checkDate: localISOTime }
              : item
          )
        };
      });

      // Fire and forget (Firebase will queue this in IndexedDB if offline)
      saveStatusApi(target.id!, status, remark, userInfo.name, localISOTime).catch((e: any) => {
        if (e?.message?.includes('Quota') || String(e).includes('Quota')) {
          alert('데이터베이스 일일 무료 사용량을 초과했습니다. 내일 다시 시도해주세요.');
        } else {
          console.error('Failed to save', e);
        }
      });
      
    } catch (e: any) {
      if (e?.message?.includes('Quota') || String(e).includes('Quota')) {
        alert('데이터베이스 일일 무료 사용량을 초과했습니다. 내일 다시 시도해주세요.');
      } else {
        console.error('Failed to update', e);
      }
    }
  };

  const filteredList = useMemo(() => {
    if (!userInfo) return [];
    let compData = userInfo.list || [];
    const roleUpper = String(userInfo.role).toUpperCase();
    if (roleUpper === 'USER') {
      compData = compData.filter(d => (d.checker || '').trim() === (userInfo.name || '').trim());
    }
    if (currentComp !== 'ALL') {
      compData = compData.filter(d => d.company === currentComp);
    }
    
    return compData.filter(d => {
      let tabMatch = true;
      if (currentTab === 'un') tabMatch = !d.status;
      if (currentTab === 'ok') tabMatch = !!d.status;
      
      if (!tabMatch) return false;
      if (search) {
        const searchTerm = search.trim();
        const safeName = d.name || "";
        const chosung = getChosung(safeName);
        return safeName.includes(searchTerm) || chosung.includes(searchTerm);
      }
      return true;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
  }, [userInfo, currentComp, currentTab, search]);

  const stats = useMemo(() => {
    if (!userInfo) return { total: 0, ok: 0, no: 0 };
    let compData = userInfo.list || [];
    const roleUpper = String(userInfo.role).toUpperCase();
    if (roleUpper === 'USER') {
      compData = compData.filter(d => (d.checker || '').trim() === (userInfo.name || '').trim());
    }
    if (currentComp !== 'ALL') {
      compData = compData.filter(d => d.company === currentComp);
    }
    const okCount = compData.filter(d => !!d.status).length;
    return {
      total: compData.length,
      ok: okCount,
      no: compData.length - okCount
    };
  }, [userInfo, currentComp]);

  const companies = useMemo(() => {
    if (!userInfo || !userInfo.list) return [];
    let list = userInfo.list || [];
    const roleUpper = String(userInfo.role).toUpperCase();
    if (roleUpper === 'USER') {
      list = list.filter(d => (d.checker || '').trim() === (userInfo.name || '').trim());
    }
    return [...new Set(list.map(d => d.company || ''))].filter(Boolean).sort();
  }, [userInfo]);

  if (!userInfo) {
    return <Login onLogin={handleLogin} isLoading={isLoading} />;
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#F2F2F7] text-[#1C1C1E] font-sans overflow-hidden">
      <header 
        className="bg-white/80 backdrop-blur-md text-[#1C1C1E] px-3 md:px-6 flex justify-between items-center shadow-sm border-b border-gray-200 shrink-0 z-50 sticky top-0"
        style={{ height: "54px" }}
      >
        <div className="flex items-center gap-2 md:gap-4 min-w-0 shrink">
          <div className="hidden sm:block px-3 py-1 bg-blue-500 rounded text-[10px] font-bold tracking-widest uppercase text-white shrink-0">HD Hyundai</div>
          <h1 className="text-[13px] leading-tight md:text-xl font-extrabold tracking-tight truncate whitespace-normal text-center">사내협력사<br className="md:hidden" /> 출입 점검 시스템 <span className="hidden md:inline-block text-blue-500 font-medium ml-2 text-sm">v9.9 Enterprise</span></h1>
        </div>
        <div className="flex items-center gap-2 md:gap-6 shrink-0">
          <div className="flex flex-col items-end mr-1 md:mr-0">
            <span className="text-[10px] md:text-sm font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">on {userInfo.name}님</span>
          </div>
          <div className="flex gap-1.5 md:gap-2">
            {String(userInfo.role).toUpperCase() === 'ADMIN' && (
              <button 
                onClick={() => setIsDashboardOpen(true)} 
                className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-50 flex items-center justify-center hover:bg-indigo-100 transition-colors"
                title="데이터 분석 대시보드"
              >
                <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
              </button>
            )}
            {String(userInfo.role).toUpperCase() === 'ADMIN' && (
              <button 
                onClick={() => setIsSettingsOpen(true)} 
                className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <Settings className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
              </button>
            )}
            <button 
              onClick={syncData} 
              className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <Zap className="w-4 h-4 md:w-5 md:h-5 text-gray-700" fill="currentColor" />
            </button>
            <button 
              onClick={manualLogout} 
              className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 text-red-400 transition-colors"
            >
              <Power className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <div className="pr-4 md:p-6 shrink-0 bg-[#F2F2F7] z-10 overflow-y-auto max-h-[50vh]" style={{ paddingLeft: "16px", paddingTop: "5px", paddingBottom: "5px" }}>
          <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
          <div className="space-y-1 relative">
            <label className="text-[10px] font-bold text-slate-500 ml-1">SELECT COMPANY</label>
            <select 
              style={{ marginBottom: "-6px", height: "40px", paddingTop: "4px", paddingBottom: "4px" }}
              value={currentComp}
              onChange={(e) => setCurrentComp(e.target.value)}
              className="w-full bg-white p-3.5 rounded-[14px] font-bold text-base shadow-sm border-0 outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition-colors"
            >
              <option value="ALL">전체 업체 보기</option>
              {companies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-[34px] text-slate-400 w-4 h-4 pointer-events-none" />
          </div>

          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <div 
              onClick={() => setCurrentTab('all')}
              className={cn(
                "p-3 md:p-4 rounded-[14px] flex flex-col justify-center cursor-pointer transition-all shadow-sm",
                currentTab === 'all' ? "bg-white ring-2 ring-blue-500" : "bg-white/60 hover:bg-white"
              )}
            >
              <p className="text-[10px] md:text-xs font-bold text-slate-500 mb-1">전체확인</p>
              <p className="text-xl md:text-2xl font-black tracking-tighter">{stats.total} <span className="text-[10px] md:text-sm font-medium text-slate-400">명</span></p>
            </div>
            <div 
              onClick={() => setCurrentTab('un')}
              className={cn(
                "p-3 md:p-4 rounded-[14px] flex flex-col justify-center cursor-pointer transition-all shadow-sm",
                currentTab === 'un' ? "bg-white ring-2 ring-red-500" : "bg-white/60 hover:bg-white"
              )}
            >
              <p className="text-[10px] md:text-xs font-bold text-red-600 mb-1">미확인</p>
              <p className="text-xl md:text-2xl font-black tracking-tighter text-red-700">{stats.no} <span className="text-[10px] md:text-sm font-medium text-red-400">명</span></p>
            </div>
            <div 
              onClick={() => setCurrentTab('ok')}
              className={cn(
                "p-3 md:p-4 rounded-[14px] flex flex-col justify-center cursor-pointer transition-all shadow-sm",
                currentTab === 'ok' ? "bg-white ring-2 ring-blue-500" : "bg-white/60 hover:bg-white"
              )}
            >
              <p className="text-[10px] md:text-xs font-bold text-blue-600 mb-1">확인</p>
              <p className="text-xl md:text-2xl font-black tracking-tighter text-blue-700">{stats.ok} <span className="text-[10px] md:text-sm font-medium text-blue-400">명</span></p>
              <div className="w-full bg-blue-200 h-1 md:h-1.5 mt-1 md:mt-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-500" 
                  style={{ width: `${stats.total > 0 ? (stats.ok / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1" style={{ height: "70.5px", paddingTop: "-3px", marginTop: "-16px" }}>
            <label className="text-[10px] font-bold text-slate-500 ml-1">SEARCH OPERATOR</label>
            <div className="relative">
              <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#e3e3e8] pl-9 pr-3 py-2.5 rounded-[10px] font-medium text-[15px] border-0 outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder:text-slate-400" style={{ height: "40px" }} 
                placeholder="이름 / 초성 검색..." 
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8e8e93] w-4 h-4 ml-1" />
            </div>
          </div>
          </div>
        </div>

        <main className="flex-1 flex flex-col overflow-hidden bg-[#F2F2F7]">
          <div className="flex-1 overflow-hidden flex flex-col gap-4" style={{ paddingTop: "4px" }}>
            <div className="w-full max-w-5xl mx-auto flex justify-between items-center px-4 md:px-6 shrink-0 mt-4">
              <h2 className="text-xs font-black text-slate-400 tracking-widest uppercase">
                Worker Registry
              </h2>
              <div className="flex gap-4 text-[10px] font-bold uppercase">
                <span className="flex items-center gap-1 text-slate-500">● Total {stats.total}</span>
                <span className="hidden md:flex items-center gap-1 text-blue-500">● Normal {stats.ok}</span>
                <span className="hidden md:flex items-center gap-1 text-red-500">● Pending {stats.no}</span>
              </div>
            </div>

            <div className="bg-white md:rounded-[20px] shadow-sm flex-1 flex flex-col overflow-hidden min-h-0 mb-0 md:mb-4 border-t md:border-x border-gray-100">
              <div className="hidden md:flex justify-center bg-white border-b border-gray-100 px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0" style={{ height: "48.5px" }}>
                <div className="flex justify-between items-center w-full max-w-5xl">
                  <div>Worker Name & DOB</div>
                  <div className="w-[140px] text-right">Actions</div>
                </div>
              </div>
              
              <div className="flex-1 overflow-hidden w-full relative">
                <Virtuoso
                  style={{ height: '100%', width: '100%' }}
                  data={filteredList}
                  itemContent={(index, item) => (
                    <WorkerRow 
                      key={item.rowIndex} 
                      item={item} 
                      currentTab={currentTab} 
                      showCompany={currentComp === 'ALL'}
                      onSave={handleSave}
                      onOpenModal={setModalWorker}
                    />
                  )}
                />
                
                {filteredList.length === 0 && (
                  <div className="py-20 text-center opacity-50">
                    <p className="text-sm font-bold text-slate-400">
                      {currentTab === 'un' ? '모두 확인했습니다.' : '내역이 없습니다.'}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="bg-slate-900 p-3 flex justify-between items-center text-[10px] text-slate-400 font-black tracking-widest px-4 md:px-6 shrink-0">
                 <div>SYSTEM STATUS: READY</div>
                 <div className="hidden md:flex gap-4">
                   <span>LATENCY: 24ms</span>
                   <span>ENCRYPTION: AES-256</span>
                   <span className="text-blue-400">OPERATING AT PEAK EFFICIENCY</span>
                 </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <ReasonModal 
        worker={modalWorker} 
        onClose={() => setModalWorker(null)} 
        onSave={handleSave} 
      />

      
      {isDashboardOpen && (
        <DashboardModal 
          workerList={userInfo?.list || []} 
          roundId={roundId} 
          onClose={() => setIsDashboardOpen(false)} 
        />
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[20px] p-6 shadow-2xl relative animate-in zoom-in-95">
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-[20px] font-bold text-[#1C1C1E] mb-6 tracking-tight">Administrator Settings</h2>
            <AdminPanel roundId={roundId} setRoundId={setRoundId} workerList={userInfo?.list || []} onUploadSuccess={() => {
              setIsSettingsOpen(false);
              syncData();
            }} />
          </div>
        </div>
      )}

      {globalLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[200] flex flex-col items-center justify-center animate-in fade-in duration-200">
          <Loader2 className="w-8 h-8 text-slate-800 animate-spin mb-4" />
          <p className="font-extrabold text-slate-800 text-sm">잠시만요...</p>
        </div>
      )}
    </div>
  );
}
