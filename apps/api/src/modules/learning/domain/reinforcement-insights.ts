/** Conservative teacher-facing signals from approved human scores and goals.
 * A score below a teacher-set goal is NOT a diagnosis or psychological label.
 */
export interface InsightCourse{
 courseId:string;
 topics:readonly {id:string;title:string;order:number}[];
 students:readonly {
  id:string;name:string;
  skills:readonly {topicId:string;mastery:number;evidenceCount:number}[];
  goals:readonly {topicId:string|null;targetMastery:number|null;status:'ACTIVE'|'ACHIEVED'|'CANCELLED'}[];
 }[];
}
export interface ReinforcementInsight{
 topicId:string;topicTitle:string;
 belowTargetCount:number;awaitingEvidenceCount:number;
 studentCount:number;
 action:'PREPARE_REINFORCEMENT'|'COLLECT_EVIDENCE';
}
export interface ReinforcementInsights{
 courseId:string;insights:ReinforcementInsight[];
 disclaimer:string;
}
export function buildReinforcementInsights(course:InsightCourse):ReinforcementInsights{
 const insights:ReinforcementInsight[]=[];
 for(const topic of course.topics){
  let belowTargetCount=0,awaitingEvidenceCount=0;
  for(const student of course.students){
   const targets=student.goals.filter(goal=>
    goal.status==='ACTIVE'&&goal.topicId===topic.id&&goal.targetMastery!==null,
   ).map(goal=>goal.targetMastery!);
   if(!targets.length)continue;
   // A student with multiple goals is counted once for this topic.
   const target=Math.max(...targets);
   const skill=student.skills.find(record=>record.topicId===topic.id);
   if(!skill||skill.evidenceCount<=0)awaitingEvidenceCount++;
   else if(skill.mastery<target)belowTargetCount++;
  }
  if(belowTargetCount>=2||awaitingEvidenceCount>=2){
   insights.push({
    topicId:topic.id,topicTitle:topic.title,belowTargetCount,awaitingEvidenceCount,
    studentCount:course.students.length,
    action:belowTargetCount>=2?'PREPARE_REINFORCEMENT':'COLLECT_EVIDENCE',
   });
  }
 }
 insights.sort((a,b)=>b.belowTargetCount-a.belowTargetCount
    ||b.awaitingEvidenceCount-a.awaitingEvidenceCount
    ||a.topicTitle.localeCompare(b.topicTitle));
 return {
  courseId:course.courseId,insights:insights.slice(0,6),
  disclaimer:'Se señalan diferencias frente a metas definidas por docentes, basadas en evaluaciones humanas. No son diagnósticos ni inferencias sobre cómo aprende una persona.',
 };
}
