import {z} from 'zod';

export const analyticsPeriodSchema=z.enum(['7d','30d','90d']);
export type AnalyticsPeriod=z.infer<typeof analyticsPeriodSchema>;
export class InvalidAnalyticsPeriod extends Error {
  constructor(){super('Analytics period must be 7d, 30d or 90d');this.name='InvalidAnalyticsPeriod';}
}
export function parseAnalyticsPeriod(raw:unknown):AnalyticsPeriod {
  if(raw===undefined)return '30d';
  const parsed=analyticsPeriodSchema.safeParse(raw);
  if(!parsed.success)throw new InvalidAnalyticsPeriod();
  return parsed.data;
}
export function analyticsDateRange(now:Date,period:AnalyticsPeriod) {
  if(!Number.isFinite(now.getTime()))throw new InvalidAnalyticsPeriod();
  const days=Number(period.slice(0,-1));
  return {
    start:new Date(now.getTime()-days*86400000),
    end:new Date(now.getTime()),
    days,
  };
}
