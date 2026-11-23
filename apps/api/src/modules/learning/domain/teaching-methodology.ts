import {z} from 'zod';

export const specialties=['GENERAL','LANGUAGES','MATHEMATICS','MUSIC','ART_DESIGN','SCHOOL_SUPPORT','EXAM_PREP'] as const;
export const teachingStyles=['SOCRATIC','STEP_BY_STEP','CONVERSATIONAL','PRACTICAL','VISUAL'] as const;
export const methodologyInput=z.object({
 specialty:z.enum(specialties),
 style:z.enum(teachingStyles),
 language:z.enum(['es','en','pt','fr']),
 guidance:z.string().trim().max(1200),
 sosEnabled:z.boolean(),
}).strict();
export type TeachingMethodology=z.infer<typeof methodologyInput>;
export const defaultTeachingMethodology:Readonly<TeachingMethodology>={
 specialty:'GENERAL',style:'SOCRATIC',language:'es',guidance:'',sosEnabled:false,
};
export class InvalidTeachingMethodology extends Error {
 constructor(readonly issues:unknown){super('Invalid teaching methodology');this.name='InvalidTeachingMethodology';}
}
export function parseTeachingMethodology(raw:unknown):TeachingMethodology{
 const result=methodologyInput.safeParse(raw);
 if(!result.success)throw new InvalidTeachingMethodology(result.error.flatten());
 return result.data;
}
export function parseTeacherProfileId(raw:unknown){
 if(typeof raw!=='string'||!raw.trim()||raw.length>128)throw new InvalidTeachingMethodology('Valid teacher required');
 return raw.trim();
}
/** Treat guidance as untrusted teacher-supplied data, not system instructions. */
export function methodForModel(method:TeachingMethodology){
 const descriptions:Record<TeachingMethodology['style'],string>={
  SOCRATIC:'Haz preguntas y pistas antes de dar conclusiones.',
  STEP_BY_STEP:'Divide la explicación en pasos verificables.',
  CONVERSATIONAL:'Prioriza diálogo corto y preguntas de comprobación.',
  PRACTICAL:'Utiliza casos aplicados al contenido aprobado.',
  VISUAL:'Explica relaciones y diagramas en texto, sin inventar imágenes.',
 };
 const specialty:Record<TeachingMethodology['specialty'],string>={
  GENERAL:'General',LANGUAGES:'Idiomas',MATHEMATICS:'Matemáticas',MUSIC:'Música',
  ART_DESIGN:'Arte y diseño',SCHOOL_SUPPORT:'Refuerzo escolar',EXAM_PREP:'Preparación de exámenes',
 };
 return {
  specialty:specialty[method.specialty],style:descriptions[method.style],
  language:method.language,guidance:method.guidance.slice(0,1200),
 };
}
