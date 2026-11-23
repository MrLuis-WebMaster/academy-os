import type {LearningAssetDraft,LearningAssetKind,LearningAssetContent} from '../domain/learning-asset.js';

export interface LearningAssetView{
 id:string;kind:LearningAssetKind;title:string;
 content:LearningAssetContent;publishedAt:Date|null;
 reflection:{sessionId:string;status:'DRAFT'|'REVIEW'|'PUBLISHED';
  session:{title:string;courseId:string|null}};
}
export interface LearningAssetsRepository{
 create(workspaceId:string,actorId:string,draft:LearningAssetDraft):Promise<LearningAssetView>;
 staff(workspaceId:string,actorId:string):Promise<LearningAssetView[]>;
 revise(workspaceId:string,actorId:string,assetId:string,raw:unknown):Promise<LearningAssetView>;
 publish(workspaceId:string,actorId:string,assetId:string):Promise<LearningAssetView>;
 student(workspaceId:string,actorId:string):Promise<LearningAssetView[]>;
}
