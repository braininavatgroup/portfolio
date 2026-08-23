export function calculateFps(intervals: number[]) {
  if (intervals.length === 0 || intervals.some((interval) => interval <= 0)) {
    return 0;
  }
  const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  return Math.round(1000 / average);
}
