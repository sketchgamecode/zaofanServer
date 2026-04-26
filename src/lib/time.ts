import { CORE_TIMEZONE } from '../config/coreRules.js';

export function getNow(): number {
  return Date.now();
}

export function getGameDateString(now: number, timeZone: string = CORE_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date(now));
}

export function isSameGameDate(a: string, b: string): boolean {
  return a === b;
}
