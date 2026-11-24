import type {CreateOrder,ReviewOrder} from '../domain/package-order.js';
export interface OrderCatalogItem{id:string;title:string;courseId:string|null;sessionCredits:number;priceCOP:number;validDays:number}
export interface OrderView{id:string;packageId:string;title:string;priceCOP:number;credits:number;validDays:number;status:string;createdAt:Date;reviewedAt:Date|null;entitlementId:string|null}
export interface ManagedOrder extends OrderView{student:{name:string};paymentReference:string|null;reviewNote:string|null;reviewer:{name:string}|null}
export interface PackageOrderRepository{
 catalog(workspaceId:string,userId:string):Promise<OrderCatalogItem[]>;
 mine(workspaceId:string,userId:string):Promise<OrderView[]>;
 create(workspaceId:string,userId:string,input:CreateOrder):Promise<OrderView>;
 cancel(workspaceId:string,userId:string,id:string):Promise<OrderView>;
 list(workspaceId:string,actorId:string):Promise<ManagedOrder[]>;
 review(workspaceId:string,actorId:string,id:string,input:ReviewOrder):Promise<OrderView>;
}
