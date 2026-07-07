export interface Worker {
  id?: string;
  checkDate?: string;
  roundId?: string;
  rowIndex: number;
  checker?: string;
  company: string;
  name: string;
  dob: string;
  targetCheck: string;
  status: string;
  remark: string;
  lastChecker?: string;
}

export interface UserInfo {
  role: 'USER' | 'ADMIN';
  name: string;
  list: Worker[];
}
