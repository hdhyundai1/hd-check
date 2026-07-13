import React, { useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Download, AlertTriangle, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { uploadExcelApi, deleteRoundApi, fetchAvailableRoundsApi } from '../lib/api';
import { Worker } from '../types';

interface AdminPanelProps {
  onUploadSuccess: () => void;
  workerList: Worker[];
  roundId: string;
  setRoundId: (r: string) => void;
}

export default function AdminPanel({ onUploadSuccess, workerList, roundId, setRoundId }: AdminPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState('');
  const [uploadProgressPercent, setUploadProgressPercent] = useState(0);
  const [deleteStep, setDeleteStep] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadStep, setUploadStep] = useState(0); // 0=none, 1=confirm, 2=success, 3=error
  const [uploadRows, setUploadRows] = useState<any[]>([]);
  const [uploadMessage, setUploadMessage] = useState('');
  const [availableRounds, setAvailableRounds] = useState<string[]>([]);

  React.useEffect(() => {
    let isMounted = true;
    fetchAvailableRoundsApi().then(rounds => {
      if (isMounted) {

        setAvailableRounds(rounds);
      }
    });
    return () => { isMounted = false; };
  }, [roundId]);

  const roundOptions = React.useMemo(() => {
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
    return options.sort((a, b) => b.id.localeCompare(a.id));
  }, [availableRounds]);



  const handleDeleteRound = () => {
    setDeleteStep(1);
  };

  const confirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteRoundApi(roundId);
      setUploadMessage('삭제가 완료되었습니다.'); setUploadStep(2);
      setDeleteStep(0);
      const rounds = await fetchAvailableRoundsApi();
      if (rounds.length > 0) {
        setRoundId(rounds[0]);
      } else {
        const d = new Date();
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setRoundId(`${yy}-${mm}-${dd}`);
      }
      onUploadSuccess();
    } catch(e: any) {
      if (e?.message?.includes('Quota') || String(e).includes('Quota')) {
        setUploadMessage('일일 할당량을 초과하여 삭제할 수 없습니다.');
      } else {
        setUploadMessage('삭제 중 오류가 발생했습니다.'); 
      }
      setUploadStep(3);
    } finally {
      setIsDeleting(false);
    }
  };

  const processUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        
        const formatExcelDate = (val: any) => {
          if (!val) return '';
          let strVal = String(val).trim();
          
          if (typeof val === 'number') {
             if (strVal.length === 5) strVal = '0' + strVal;
             if (strVal.length === 6) return `${strVal.slice(0,2)}.${strVal.slice(2,4)}.${strVal.slice(4,6)}`;
             if (strVal.length === 8) return `${strVal.slice(2,4)}.${strVal.slice(4,6)}.${strVal.slice(6,8)}`;
             if (val > 0 && val < 300000) {
                 const d = new Date((val - 25569) * 86400 * 1000);
                 const yy = String(d.getUTCFullYear()).slice(-2);
                 const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                 const dd = String(d.getUTCDate()).padStart(2, '0');
                 return `${yy}.${mm}.${dd}`;
             }
          }
          
          let str = strVal.replace(/[-/]/g, '.');
          const parts = str.split('.');
          if (parts.length === 3) {
             const y = parts[0].length === 4 ? parts[0].slice(-2) : parts[0].padStart(2, '0');
             const m = parts[1].padStart(2, '0');
             const d = parts[2].padStart(2, '0');
             return `${y}.${m}.${d}`;
          }
          
          const digitOnly = str.replace(/\D/g, '');
          if (digitOnly.length === 8) return `${digitOnly.slice(2,4)}.${digitOnly.slice(4,6)}.${digitOnly.slice(6,8)}`;
          if (digitOnly.length === 6) return `${digitOnly.slice(0,2)}.${digitOnly.slice(2,4)}.${digitOnly.slice(4,6)}`;
          if (digitOnly.length === 5) {
             const pad = '0' + digitOnly;
             return `${pad.slice(0,2)}.${pad.slice(2,4)}.${pad.slice(4,6)}`;
          }
          
          return str;
        };
        
        const normalizeTargetCheck = (val: any) => {
            if (val === undefined || val === null) return '';
            const str = String(val).trim().toLowerCase();
            if (['o', 'ㅇ', '0', '○', 'v'].includes(str)) return 'O';
            return str;
        };

        const rows = (json.slice(1) as any[]).filter(r => r[2] && r[4]).map(r => [
          r[0], // 순번
          r[1], // 점검자
          r[2], // 업체
          r[4], // 이름 (r[3]은 사번이므로 무시)
          formatExcelDate(r[5]), // 생년월일
          normalizeTargetCheck(r[6]) // 집중점검
        ]);
        
        setUploadRows(rows);
        setUploadStep(1); // show confirm modal
      } catch (err) {
        console.error(err);
        setUploadMessage('업로드 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
        setUploadStep(3); // show error modal
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };
    

  const confirmUpload = async () => {
    try {
      setIsUploading(true);
      setUploadProgressMsg('준비 중...');
      setUploadProgressPercent(0);
      await uploadExcelApi(roundId, uploadRows, (msg, percent) => {
        setUploadProgressMsg(msg);
        setUploadProgressPercent(percent);
      });
      setUploadMessage(`성공적으로 ${uploadRows.length}명의 명단이 업로드되었습니다.`);
      setUploadStep(2); // success
      onUploadSuccess();
    } catch(err: any) {
      if (err?.message?.includes('Quota') || String(err).includes('Quota')) {
        setUploadMessage('일일 할당량을 초과하여 업로드할 수 없습니다.');
      } else {
        console.error(err);
        setUploadMessage('업로드 서버 오류가 발생했습니다.');
      }
      setUploadStep(3); // error
    } finally {
      setIsUploading(false);
      setUploadProgressMsg('');
      setUploadProgressPercent(0);
    }
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const headers = ['순번', '점검자', '업체', '사번', '이름', '생년월일', '집중점검'];
    
    const companies = ['삼성물산', '현대건설', '대우건설', 'GS건설', '포스코이앤씨', 'DL이앤씨', 'SK에코플랜트', '롯데건설', 'HDC현대산업개발', '호반건설'];
    const checkers = ['김반장', '이소장', '박과장', '최대리', '정주임', '강팀장', '조프로', '윤책임', '임선임', '한주임'];
    const names = ['가', '강', '건', '경', '고', '관', '광', '구', '규', '근', '기', '길', '나', '남', '노', '누', '다', '단', '달', '담', '대', '도', '동', '두', '라', '래', '로', '루', '리', '마', '만', '명', '무', '문', '미', '민', '바', '박', '백', '범', '보', '본', '봉', '부', '사', '산', '상', '새', '서', '석', '선', '설', '섭', '성', '세', '소', '솔', '수', '숙', '순', '슬', '승', '시', '신', '아', '안', '애', '양', '어', '연', '영', '예', '오', '옥', '온', '완', '용', '우', '원', '월', '위', '유', '윤', '율', '은', '을', '음', '의', '이', '익', '인', '일', '잎', '자', '잔', '장', '재', '전', '정', '제', '조', '종', '주', '준', '중', '지', '진', '찬', '창', '채', '천', '철', '초', '태', '하', '한', '해', '혁', '현', '형', '혜', '호', '홍', '화', '환', '회', '효', '훈', '휘', '희'];
    
    const rows: any[][] = [headers];
    for (let i = 1; i <= 2; i++) {
      const company = companies[Math.floor(Math.random() * companies.length)];
      const checker = checkers[Math.floor(Math.random() * checkers.length)];
      
      const lastName = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍'][Math.floor(Math.random() * 20)];
      const firstName = names[Math.floor(Math.random() * names.length)] + names[Math.floor(Math.random() * names.length)];
      const name = lastName + firstName;
      
      const year = Math.floor(Math.random() * (99 - 60 + 1)) + 60;
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
      const dob = `${year}.${month}.${day}`;
      
      const targetCheck = Math.random() > 0.8 ? 'O' : '';
      
      const empNo = Math.floor(Math.random() * 900000) + 100000;
      rows.push([i, checker, company, empNo, name, dob, targetCheck]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "업로드양식");
    XLSX.writeFile(wb, "명단업로드_템플릿.xlsx");
  };

  const parseRemark = (remark: string) => {
    if (!remark) return { reason: '', date: '' };
    const match = remark.match(/^(.*?)\s*\(([\d.\s~]+)\)$/);
    if (match) {
      return { reason: match[1].trim(), date: match[2].trim() };
    }
    return { reason: remark, date: '' };
  };

  const handleDownloadData = () => {
    const wb = XLSX.utils.book_new();
    const rows = workerList.map((w, index) => {
      const { reason, date } = parseRemark(w.remark || '');
      return [
        index + 1,
        w.lastChecker || w.checker || '',
        w.checkDate || '',
        w.company,
        '', // 사번
        w.name,
        w.dob,
        w.targetCheck,
        w.status || '미작성',
        reason,
        date
      ];
    });
    const header = ['순번', '점검자', '점검일자', '업체명', '사번', '이름', '생년월일', '집중점검', '출근여부', '부재중 사유', '날짜'];
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "출근현황");
    
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    XLSX.writeFile(wb, `사내협력사 출입 점검현황(${roundId.replace('_', '~')}).xlsx`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-slate-200 rounded-xl text-left shadow-sm" style={{ padding: "8px" }}>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[13px] font-semibold text-[#8E8E93] ml-1">점검 기간 선택 (차수)</label>
          {availableRounds.length > 0 ? (
            <select 
              value={roundId} 
              onChange={(e) => setRoundId(e.target.value)}
              className="text-xs bg-slate-100 border-none rounded-lg px-2 py-1 outline-none font-bold text-slate-700"
              style={{ width: "128px", height: "28px" }}
            >
              <option value={roundId} disabled className="hidden">현재: {roundId.replace('_', ' ~ ')}</option>
              {roundOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded">명단 없음</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="date"
            value={roundId.split('_')[0] || ''}
            onChange={e => {
              const from = e.target.value;
              const to = roundId.split('_')[1] || from;
              setRoundId(`${from}_${to}`);
            }}
            className="bg-[#F2F2F7] border-0 rounded-[12px] font-medium text-[15px] outline-none text-[#1C1C1E]"
            style={{ width: "123px", padding: "5px" }}
          />
          <span className="text-slate-400 font-medium">~</span>
          <input 
            type="date"
            value={roundId.split('_')[1] || roundId.split('_')[0] || ''}
            onChange={e => {
              const to = e.target.value;
              const from = roundId.split('_')[0] || to;
              setRoundId(`${from}_${to}`);
            }}
            className="bg-[#F2F2F7] border-0 rounded-[12px] font-medium text-[15px] outline-none text-[#1C1C1E]"
            style={{ width: "134px", padding: "5px" }}
          />
        </div>
      </div>
      <div className="px-5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3" style={{ height: "90px", paddingTop: "10px", paddingBottom: "10px" }}>
        <h3 className="text-xs font-black text-slate-500 flex items-center gap-2 uppercase tracking-widest">
          <Download className="w-4 h-4" />
          Data Export & Templates
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={handleDownloadTemplate}
            className="bg-white border border-slate-300 text-slate-700 py-3 rounded-lg font-bold text-xs shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center" style={{ height: "40px" }}
          >
            템플릿 다운로드
          </button>
          <button 
            onClick={handleDownloadData}
            className="bg-blue-600 border border-blue-700 text-white py-3 rounded-lg font-bold text-xs shadow-sm hover:bg-blue-700 transition-colors flex items-center justify-center" style={{ height: "40px" }}
          >
            현재 현황 다운로드
          </button>
        </div>
      </div>

      <div className="p-5 bg-white border border-slate-200 rounded-xl text-center shadow-sm" style={{ height: "243.5px" }}>
        <h3 className="text-[13px] font-semibold text-[#8E8E93] mb-3 flex items-center justify-center uppercase tracking-wide">
          <FileSpreadsheet className="w-4 h-4 mr-2 text-slate-500" />
          Batch Upload
        </h3>
        


        <div className="text-[11px] font-medium text-[#8E8E93] bg-[#F2F2F7] p-2.5 rounded-[10px] mb-4 flex flex-col gap-1 items-center border-0">
          <span className="text-slate-400 uppercase tracking-widest">Excel Format (Columns A to G)</span>
          <span className="text-blue-600">[순번] [점검자] [업체] [사번] [이름] [생년월일] [집중점검]</span>
        </div>
        
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden" 
          accept=".xlsx, .xls, .xlsm, .xlsb, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
          onChange={processUpload} 
        />
        <button 
          onClick={() => fileInputRef.current?.click()} 
          disabled={isUploading}
          className="w-full bg-[#007AFF] text-white rounded-[14px] font-semibold text-[15px] shadow-sm active:opacity-70 transition-all flex items-center justify-center gap-2" style={{ height: "40px" }}
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Sync Spreadsheet
        </button>
        <button 
          onClick={handleDeleteRound}
          disabled={isUploading || isDeleting}
          className="w-full bg-[#FF3B30]/10 text-[#FF3B30] rounded-[14px] font-semibold text-[15px] hover:bg-[#FF3B30]/20 active:opacity-70 transition-all flex items-center justify-center gap-2 mt-3" style={{ height: "40px" }}
        >
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          명단 초기화 (삭제)
        </button>

      </div>

      {deleteStep > 0 && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[20px] p-6 shadow-2xl animate-in zoom-in-95 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[20px] text-[#1C1C1E] tracking-tight mb-2">
              {deleteStep === 1 ? '정말로 삭제하시겠습니까?' : '마지막 경고: 진짜로 삭제하시겠습니까?'}
            </h3>
            <p className="text-sm font-medium text-[15px] text-[#8E8E93] mb-6 leading-relaxed">
              [{roundId.replace('_', ' ~ ')}] 점검 명단을<br/>완전히 삭제합니다. {deleteStep === 2 && '이 작업은 되돌릴 수 없습니다.'}
            </p>
            
            {deleteStep === 1 ? (
              <div className="flex gap-2">
                <button 
                  onClick={() => setDeleteStep(0)}
                  disabled={isDeleting}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3.5 rounded-[14px] font-semibold text-[15px] transition-colors"
                >
                  취소 (유지)
                </button>
                <button 
                  onClick={() => setDeleteStep(2)}
                  disabled={isDeleting}
                  className="flex-1 bg-[#FF3B30] hover:bg-[#D70015] text-white py-3.5 rounded-[14px] font-semibold text-[15px] transition-colors"
                >
                  삭제하기
                </button>
              </div>
            ) : (
              <div className="flex gap-2 flex-row-reverse">
                <button 
                  onClick={() => setDeleteStep(0)}
                  disabled={isDeleting}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3.5 rounded-[14px] font-semibold text-[15px] transition-colors"
                >
                  취소 (유지)
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 bg-[#FF3B30] hover:bg-[#D70015] text-white py-3.5 rounded-[14px] font-semibold text-[15px] transition-colors"
                >
                  진짜 삭제합니다
                </button>
              </div>
            )}
            
            {deleteStep === 2 && (
              <p className="text-[10px] text-slate-400 font-bold mt-3">* 실수를 방지하기 위해 취소 버튼 위치가 변경되었습니다.</p>
            )}
          </div>
        </div>
      )}
      {uploadStep > 0 && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[20px] p-6 shadow-2xl animate-in zoom-in-95 text-center">
            {uploadStep === 1 && (
              <>
                <FileSpreadsheet className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[20px] text-[#1C1C1E] tracking-tight mb-2">명단 업로드 확인</h3>
                <p className="text-sm font-medium text-[15px] text-[#8E8E93] mb-6 leading-relaxed">
                  [{roundId.replace('_', ' ~ ')}] 기간의 기존 명단을 삭제하고<br/>
                  <span className="text-blue-600">신규 {uploadRows.length}명</span>으로 덮어씁니다.<br/>
                  진행하시겠습니까?
                </p>
                {isUploading && (
                  <div className="mb-6">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{uploadProgressMsg}</span>
                      <span>{Math.round(uploadProgressPercent)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgressPercent}%` }}></div>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 flex-row-reverse">
                  <button 
                    onClick={() => setUploadStep(0)}
                    disabled={isUploading}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3.5 rounded-[14px] font-semibold text-[15px] transition-colors"
                  >
                    취소
                  </button>
                  <button 
                    onClick={confirmUpload}
                    disabled={isUploading}
                    className="flex-1 bg-[#007AFF] hover:bg-[#0056b3] text-white py-3.5 rounded-[14px] font-semibold text-[15px] transition-colors flex justify-center items-center gap-2"
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    업로드
                  </button>
                </div>
              </>
            )}
            
            {uploadStep === 2 && (
              <>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <div className="w-6 h-6 border-b-2 border-r-2 border-green-600 transform rotate-45 mb-1" />
                </div>
                <h3 className="text-lg font-bold text-[20px] text-[#1C1C1E] tracking-tight mb-2">업로드 완료</h3>
                <p className="text-sm font-medium text-[15px] text-[#8E8E93] mb-6 leading-relaxed">
                  {uploadMessage}
                </p>
                <button 
                  onClick={() => setUploadStep(0)}
                  className="w-full bg-[#007AFF] text-white py-3.5 rounded-[14px] font-semibold text-[15px] transition-colors"
                >
                  확인
                </button>
              </>
            )}
            
            {uploadStep === 3 && (
              <>
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[20px] text-[#1C1C1E] tracking-tight mb-2">업로드 실패</h3>
                <p className="text-sm font-medium text-[15px] text-[#8E8E93] mb-6 leading-relaxed">
                  {uploadMessage}
                </p>
                <button 
                  onClick={() => setUploadStep(0)}
                  className="w-full bg-gray-100 text-gray-800 py-3.5 rounded-[14px] font-semibold text-[15px] transition-colors"
                >
                  닫기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>

  );
}
