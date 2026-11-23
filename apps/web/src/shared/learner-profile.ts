export interface NextLearningAction {
 goalId:string;courseId:string;courseTitle:string;title:string;
 topicTitle:string|null;targetMastery:number|null;verifiedMastery:number|null;
 reason:'BELOW_TARGET'|'NO_EVIDENCE'|'ACTIVE_GOAL';targetAt:string|null;
}
export interface LearningMilestone{
 goalId:string;title:string;courseTitle:string;completedAt:string|null;
}
export interface EvidenceBasedProfile{
 verifiedCompetencies:number;humanEvidenceCount:number;
 activeGoals:number;achievedGoals:number;
 nextActions:NextLearningAction[];milestones:LearningMilestone[];
 disclaimer:string;
}
