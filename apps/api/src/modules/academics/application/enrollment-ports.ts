export interface EnrolledStudent {
  id: string; courseId: string; userId: string; createdAt: Date;
}
export interface EnrollmentRepository {
  courseExists(workspaceId:string,courseId:string):Promise<boolean>;
  studentIsMember(workspaceId:string,userId:string):Promise<boolean>;
  add(workspaceId:string,courseId:string,userId:string):Promise<EnrolledStudent>;
  remove(workspaceId:string,courseId:string,userId:string):Promise<boolean>;
}
