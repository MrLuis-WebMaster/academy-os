export type ReflectionStatus='DRAFT'|'REVIEW'|'PUBLISHED';
export interface SavedReflection {
  id:string;sessionId:string;status:ReflectionStatus;notes:string;
}
export interface PublishedReflection {
  id:string;status:ReflectionStatus;approvedAt:Date|null;
}
export interface StaffReflection {
  id:string;sessionId:string;status:ReflectionStatus;notes:string;
  approvedAt:Date|null;session:{title:string;courseId:string|null};
}
export interface StudentReflection {
  id:string;notes:string;approvedAt:Date|null;
  session:{id:string;courseId:string|null;title:string};
}
export interface ReflectionRepository {
  listStaff(workspaceId:string,userId:string):Promise<StaffReflection[]>;
  listStudent(workspaceId:string,userId:string):Promise<StudentReflection[]>;
  save(workspaceId:string,userId:string,sessionId:string,notes:string):Promise<SavedReflection>;
  publish(workspaceId:string,userId:string,sessionId:string):Promise<PublishedReflection>;
}
