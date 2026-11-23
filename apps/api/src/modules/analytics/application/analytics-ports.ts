import type {AnalyticsPeriod} from '../domain/analytics-period.js';

export interface AnalyticsOverview {
  period:AnalyticsPeriod;
  from:Date;through:Date;
  people:{students:number;teachers:number;courses:number};
  classes:{
    scheduled:number;completed:number;cancelled:number;
    bookedSeats:number;attendanceRecorded:number;
  };
  learning:{
    practiceAttempts:number;averagePracticeScore:number|null;
    assessedCompetencies:number;activeGoals:number;
  };
  finances:{manualCollectedCOP:number;voidedReceipts:number};
  notes:string[];
}
export interface AnalyticsRepository {
  overview(workspaceId:string,actorId:string,start:Date,end:Date,period:AnalyticsPeriod):
    Promise<AnalyticsOverview>;
}
