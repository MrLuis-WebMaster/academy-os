import type {GoogleCredential,OAuthAttempt} from '../domain/google-connection.js';
export interface GoogleOAuthPort{
 configured():boolean;
 authorizationUrl(state:string,verifier:string):string;
 exchange(code:string,verifier:string):Promise<GoogleCredential>;
}
export interface IntegrationCryptoPort{
 nonce():string;
 digest(value:string):string;
 seal(value:string,context:string):string;
 open(value:string,context:string):string;
}
export interface GoogleConnectionRepository{
 status(workspaceId:string,userId:string):Promise<Date|null>;
 begin(attempt:OAuthAttempt):Promise<void>;
 consume(stateHash:string,userId:string,now:Date):Promise<OAuthAttempt|null>;
 save(attempt:OAuthAttempt,encryptedCredential:string):Promise<void>;
 disconnect(workspaceId:string,userId:string):Promise<void>;
}
