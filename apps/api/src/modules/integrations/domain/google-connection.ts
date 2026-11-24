export const CALENDAR_SCOPE='https://www.googleapis.com/auth/calendar.events.owned';
export type GoogleCredential={accessToken:string;refreshToken:string;expiresAt:number;scope:string};
export type OAuthAttempt={stateHash:string;workspaceId:string;userId:string;encryptedVerifier:string;expiresAt:Date};
export type ConnectionStatus={configured:boolean;connected:boolean;connectedAt:Date|null};
export class IntegrationDenied extends Error{}
export class IntegrationUnavailable extends Error{}
export class InvalidAuthorization extends Error{}
export function validGoogleCredential(value:unknown,now=Date.now()):GoogleCredential{
 if(!value||typeof value!=='object')throw new InvalidAuthorization('Invalid provider credentials');
 const v=value as Record<string,unknown>;
 if(typeof v.access_token!=='string'||!v.access_token||typeof v.refresh_token!=='string'||!v.refresh_token||
    typeof v.expires_in!=='number'||!Number.isFinite(v.expires_in)||v.expires_in<=0||
    typeof v.scope!=='string'||!v.scope.split(/\s+/).includes(CALENDAR_SCOPE)){
  throw new InvalidAuthorization('Required Google Calendar permissions or offline access were not granted');
 }
 return {accessToken:v.access_token,refreshToken:v.refresh_token,expiresAt:now+v.expires_in*1000,scope:v.scope};
}
