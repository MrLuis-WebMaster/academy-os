import type {Assignment,PlanCode,Usage} from '../domain/plan.js';
export interface SaasRepository{
 isOperator(userId:string):Promise<boolean>;
 summary(workspaceId:string,userId:string):Promise<{assignment:Assignment|null;usage:Usage}>;
 list(userId:string,after:string|null):Promise<{id:string;name:string;slug:string;assignment:Assignment|null}[]>;
 assign(userId:string,workspaceId:string,input:{plan:PlanCode;validUntil:Date|null;reason:string}):Promise<Assignment>;
}
