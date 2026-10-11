import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getChosung(str: string) {
  if (!str) return "";
  const cho = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  let result = "";
  for(let i=0; i<str.length; i++) {
    const code = str.charCodeAt(i) - 44032;
    if(code > -1 && code < 11172) result += cho[Math.floor(code/588)];
    else result += str.charAt(i);
  }
  return result;
}

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'confirm';

export function triggerHaptic(typeOrPattern: HapticType | number | number[] = 'light') {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;
  try {
    let pattern: number | number[];
    if (typeof typeOrPattern === 'number' || Array.isArray(typeOrPattern)) {
      pattern = typeOrPattern;
    } else {
      switch (typeOrPattern) {
        case 'light':
          pattern = 20; // 톡! 가벼운 탭 (차수, 업체 선택, 탭 전환, 초성 키보드 등)
          break;
        case 'medium':
          pattern = 45; // 틱! 명확한 클릭감 (정상출근, 부재중, 모달 열기/닫기 등)
          break;
        case 'heavy':
          pattern = 70; // 묵직한 액션 (저장, 리셋 등)
          break;
        case 'confirm':
        case 'success':
          pattern = [50, 40, 70]; // 확실한겨?, 최종 전송 등
          break;
        default:
          pattern = 25;
      }
    }
    navigator.vibrate(pattern);
  } catch (_) {
    // Ignore error on devices without vibration motor
  }
}

