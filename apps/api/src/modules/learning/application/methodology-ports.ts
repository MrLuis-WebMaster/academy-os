import type {TeachingMethodology} from '../domain/teaching-methodology.js';
export interface TeacherMethodologyRepository {
 read(workspaceId:string,actorId:string,profileId:string):Promise<TeachingMethodology>;
 save(workspaceId:string,actorId:string,profileId:string,method:TeachingMethodology):Promise<TeachingMethodology>;
}
