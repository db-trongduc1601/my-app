/**
 * Relative time in Vietnamese, using UTC timestamps correctly.
 * Fixes the "7 giờ trước" bug caused by timezone offset confusion.
 */
export function timeAgo(dateVal) {
    if (!dateVal) return '';
    let past;
    if (typeof dateVal === 'string') {
      // Ensure the string is treated as UTC — append 'Z' if no timezone info present
      const normalized = /[Zz]$|[+-]\d{2}:\d{2}$/.test(dateVal) ? dateVal : dateVal + 'Z';
      past = new Date(normalized).getTime();
    } else if (typeof dateVal.toMillis === 'function') {
      past = dateVal.toMillis();
    } else if (dateVal instanceof Date) {
      past = dateVal.getTime();
    } else if (typeof dateVal === 'number') {
      past = dateVal;
    } else if (dateVal.seconds !== undefined) {
      past = dateVal.seconds * 1000 + (dateVal.nanoseconds || 0) / 1000000;
    } else {
      past = new Date(dateVal).getTime();
    }
    const now = Date.now();
    const diffMs = now - past;
  
    if (diffMs < 0) return 'Vừa xong';
  
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return diffSec <= 1 ? '1 giây trước' : `${diffSec} giây trước`;
  
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
  
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} giờ trước`;
  
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD} ngày trước`;
  
    const diffW = Math.floor(diffD / 7);
    if (diffW < 4) return `${diffW} tuần trước`;
  
    const diffM = Math.floor(diffD / 30);
    if (diffM < 12) return `${diffM} tháng trước`;
  
    const diffY = Math.floor(diffD / 365);
    return `${diffY} năm trước`;
  }