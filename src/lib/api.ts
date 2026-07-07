import { collection, doc, setDoc, getDocs, query, where, writeBatch, deleteDoc , onSnapshot} from 'firebase/firestore';
import { db } from './firebase';
import { Worker } from '../types';

const API_URL = "https://script.google.com/macros/s/AKfycbxvAUmXeMto7iV_UDwS-N_nrRz7jxIzK0EqBt8vWdN1zp5ID2hZVjaJ_K_2KGKEHdVH/exec";

export async function loginApi(name: string, pw: string) {
  if (!name || !pw) return { status: 'error', message: '이름과 비밀번호를 입력해주세요.' };
  
  if (name === 'admin' || name === '관리자') {
    if (pw === '9999') {
      return { status: 'success', role: 'ADMIN', name: '관리자' };
    } else {
      return { status: 'error', message: '관리자 비밀번호가 일치하지 않습니다.' };
    }
  }

  if (pw !== '1234') {
    return { status: 'error', message: '비밀번호가 일치하지 않습니다.' };
  }

  try {
    const q = query(collection(db, 'users'), where('name', '==', name));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      const userDoc = snap.docs[0].data();
      return { status: 'success', role: userDoc.role || 'USER', name: userDoc.name };
    }

    // 신규 사용자 자동 등록
    const newRef = doc(collection(db, 'users'));
    await setDoc(newRef, {
      name,
      pw,
      role: 'USER',
      createdAt: new Date().toISOString()
    });

    return { status: 'success', role: 'USER', name };
  } catch (error) {
    console.error('Firebase Login Error:', error);
    return { status: 'success', role: 'USER', name };
  }
}

export async function fetchWorkersApi(roundId: string): Promise<Worker[]> {
  const q = query(collection(db, 'workers'), where('roundId', '==', roundId));
  const snap = await getDocs(q);
  const workers: Worker[] = [];
  snap.forEach(d => {
    workers.push({ id: d.id, ...d.data() } as Worker);
  });
  // Sort by rowIndex
  workers.sort((a, b) => a.rowIndex - b.rowIndex);
  return workers;
}

export async function saveStatusApi(
  id: string, 
  status: string, 
  remark: string, 
  checker: string,
  checkDate: string
) {
  const ref = doc(db, 'workers', id);
  await setDoc(ref, {
    status,
    remark,
    lastChecker: checker,
    checkDate
  }, { merge: true });
}

export async function uploadExcelApi(roundId: string, rows: any[]) {
  const withTimeout = (promise: Promise<any>, ms: number, msg: string) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT: ' + msg)), ms))
    ]);
  };

  try {
    console.log("uploadExcelApi: fetching existing docs...");
    const q = query(collection(db, 'workers'), where('roundId', '==', roundId));
    const snap = await withTimeout(getDocs(q), 10000, "getDocs");
    
    console.log("uploadExcelApi: found " + snap.size + " docs to delete.");
    let batch1 = writeBatch(db);
    let count = 0;
    for (const d of snap.docs) {
      batch1.delete(d.ref);
      count++;
      if (count === 400) {
        console.log("uploadExcelApi: committing delete batch of 400...");
        await withTimeout(batch1.commit(), 15000, "delete batch commit");
        batch1 = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      console.log("uploadExcelApi: committing final delete batch...");
      await withTimeout(batch1.commit(), 15000, "delete batch commit");
    }

    console.log("uploadExcelApi: inserting " + rows.length + " new rows...");
    let batch = writeBatch(db);
    let ops = 0;
    for (const r of rows) {
      const newDoc = doc(collection(db, 'workers'));
      batch.set(newDoc, {
        roundId: roundId || '',
        rowIndex: r[0] ?? 0,
        checker: String(r[1] ?? ''),
        company: String(r[2] ?? ''),
        name: String(r[3] ?? ''),
        dob: String(r[4] ?? ''),
        targetCheck: String(r[5] ?? ''),
        status: '',
        remark: '',
        lastChecker: '',
        checkDate: ''
      });
      ops++;
      if (ops === 400) {
        console.log("uploadExcelApi: committing insert batch of 400...");
        await withTimeout(batch.commit(), 15000, "insert batch commit");
        batch = writeBatch(db);
        ops = 0;
      }
    }
    if (ops > 0) {
      console.log("uploadExcelApi: committing final insert batch of " + ops + "...");
      await withTimeout(batch.commit(), 15000, "final insert batch commit");
    }
    
    // Make sure to add to rounds collection as well
    await setDoc(doc(db, 'rounds', roundId), { createdAt: new Date() }, { merge: true });
    console.log("uploadExcelApi: finished successfully.");
  } catch (err) {
    console.error("uploadExcelApi FATAL ERROR:", err);
    throw err;
  }
}

export async function deleteRoundApi(roundId: string) {
  const withTimeout = (promise: Promise<any>, ms: number, msg: string) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT: ' + msg)), ms))
    ]);
  };
  
  console.log("deleteRoundApi: fetching existing docs...");
  const q = query(collection(db, 'workers'), where('roundId', '==', roundId));
  const snap = await withTimeout(getDocs(q), 10000, "getDocs");
  
  console.log("deleteRoundApi: found " + snap.size + " docs to delete.");
  let batch = writeBatch(db);
  let count = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    count++;
    if (count === 400) {
      console.log("deleteRoundApi: committing delete batch of 400...");
      await withTimeout(batch.commit(), 15000, "delete batch commit");
      batch = writeBatch(db);
      count = 0;
    }
  }
  
  // Delete from rounds collection as well
  const roundRef = doc(db, 'rounds', roundId);
  batch.delete(roundRef);
  count++;
  
  if (count > 0) {
    console.log("deleteRoundApi: committing final delete batch...");
    await withTimeout(batch.commit(), 15000, "delete batch commit");
  }
  console.log("deleteRoundApi: finished successfully.");
}
export async function fetchAvailableRoundsApi(): Promise<string[]> {
  try {
    const q = query(collection(db, 'rounds'));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      return snap.docs.map(d => d.id).sort().reverse();
    }
    return [];
  } catch (error) {
    console.error("fetchAvailableRoundsApi Error:", error);
    return [];
  }
}

export function subscribeWorkersApi(roundId: string, callback: (list: Worker[]) => void) {
  const q = query(collection(db, 'workers'), where('roundId', '==', roundId));
  return onSnapshot(q, (snap) => {
    const list: Worker[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as Worker);
    });
    
    // sorting same as fetchWorkersApi
    list.sort((a, b) => {
      const cA = a.company || '';
      const cB = b.company || '';
      if (cA !== cB) return cA.localeCompare(cB);
      
      const nA = a.name || '';
      const nB = b.name || '';
      return nA.localeCompare(nB);
    });
    
    // Debounce to stabilize UI with concurrent users
    if ((callback as any).__debounceTimer) {
      clearTimeout((callback as any).__debounceTimer);
    }
    (callback as any).__debounceTimer = setTimeout(() => {
      callback(list);
    }, 200);
  }, (error) => {
    console.error("subscribeWorkersApi error", error);
  });
}
