/** Explanations derived solely from teacher-reviewed skills and active learning goals.
 * No psychological labels, diagnosis, inferred learning styles or AI-derived mastery.
 */
export interface ProfileSkill{
 topicId:string;mastery:number;evidenceCount:number;
 topic:{title:string;courseId:string;course:{title:string}};
}
export interface ProfileGoal{
 id:string;courseId:string;topicId:string|null;title:string;
 targetMastery:number|null;targetAt:Date|null;
 status:'ACTIVE'|'ACHIEVED'|'CANCELLED';completedAt:Date|null;
 course:{title:string};
}
export type NextLearningAction={
 goalId:string;courseId:string;courseTitle:string;title:string;
 topicTitle:string|null;targetMastery:number|null;verifiedMastery:number|null;
 reason:'BELOW_TARGET'|'NO_EVIDENCE'|'ACTIVE_GOAL';targetAt:Date|null;
};
export type LearningMilestone={goalId:string;title:string;courseTitle:string;completedAt:Date|null};
export interface EvidenceBasedProfile{
 verifiedCompetencies:number;humanEvidenceCount:number;
 activeGoals:number;achievedGoals:number;
 nextActions:NextLearningAction[];
 milestones:LearningMilestone[];
 disclaimer:string;
}
const priority:Record<NextLearningAction['reason'],number>={
 BELOW_TARGET:0,NO_EVIDENCE:1,ACTIVE_GOAL:2,
};
export function buildEvidenceBasedProfile(
 skills:readonly ProfileSkill[],goals:readonly ProfileGoal[],
):EvidenceBasedProfile{
 const skillMap=new Map(skills.map(skill=>[skill.topicId,skill]));
 const nextActions=goals.filter(goal=>goal.status==='ACTIVE').map(goal=>{
  const skill=goal.topicId?skillMap.get(goal.topicId):undefined;
  const verifiedMastery=skill?.evidenceCount?skill.mastery:null;
  const reason:NextLearningAction['reason']=
    goal.topicId&&verifiedMastery===null?'NO_EVIDENCE'
    :goal.targetMastery!==null&&verifiedMastery!==null&&verifiedMastery<goal.targetMastery
      ?'BELOW_TARGET':'ACTIVE_GOAL';
  return {
   goalId:goal.id,courseId:goal.courseId,courseTitle:goal.course.title,
   title:goal.title,topicTitle:skill?.topic.title??null,
   targetMastery:goal.targetMastery,verifiedMastery,reason,targetAt:goal.targetAt,
  };
 }).sort((a,b)=>priority[a.reason]-priority[b.reason]
    ||(a.targetAt?.getTime()??Infinity)-(b.targetAt?.getTime()??Infinity)
    ||a.goalId.localeCompare(b.goalId)).slice(0,6);
 return {
  verifiedCompetencies:skills.filter(skill=>skill.evidenceCount>0).length,
  humanEvidenceCount:skills.reduce((sum,skill)=>sum+skill.evidenceCount,0),
  activeGoals:goals.filter(goal=>goal.status==='ACTIVE').length,
  achievedGoals:goals.filter(goal=>goal.status==='ACHIEVED').length,
  nextActions,
  milestones:goals.filter(goal=>goal.status==='ACHIEVED').map(goal=>({
   goalId:goal.id,title:goal.title,courseTitle:goal.course.title,completedAt:goal.completedAt,
  })).sort((a,b)=>(b.completedAt?.getTime()??0)-(a.completedAt?.getTime()??0)).slice(0,12),
  disclaimer:'Sugerencias basadas únicamente en metas y evaluaciones registradas por docentes. No describen personalidad, capacidades innatas ni estilos psicológicos.',
 };
}
