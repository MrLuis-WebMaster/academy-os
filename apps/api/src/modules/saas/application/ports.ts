import type {Assignment,PlanCode,Usage} from '../domain/plan.js';
export interface SaasRepository{
 isOperator(userId:string):Promise<boolean>;
 summary(workspaceId:string,userId:string):Promise<{assignment:Assignment|null;usage:Usage}>;
 list(userId:string,after:string|null):Promise<{id:string;name:string;slug:string;assignment:Assignment|null}[]>;
 overview(userId:string):Promise<{academies:number;solo:number;institutional:number;activePro:number;activeAcademy:number;starter:number;expired:number}>;
 audit(userId:string,workspaceId:string,after:string|null):Promise<{id:string;actorUserId:string;previousPlan:PlanCode;nextPlan:PlanCode;validUntil:Date|null;reason:string;createdAt:Date}[]>;
 assign(userId:string,workspaceId:string,input:{plan:PlanCode;validUntil:Date|null;reason:string}):Promise<Assignment>;
}
