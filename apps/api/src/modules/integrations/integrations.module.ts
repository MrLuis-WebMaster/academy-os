import {Module} from '@nestjs/common';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {GoogleCalendarConnection} from './application/google-use-cases.js';
import {ExportClassToCalendar} from './application/calendar-use-cases.js';
import {PrismaGoogleConnection} from './infrastructure/prisma-google-connection.js';
import {PrismaCalendarExport} from './infrastructure/prisma-calendar-export.js';
import {OAuthCrypto} from './infrastructure/oauth-crypto.js';
import {GoogleOAuth} from './infrastructure/google-oauth.js';
import {GoogleCalendarEvents} from './infrastructure/google-calendar-events.js';
import {GoogleConnectionController} from './presentation/google-connection.controller.js';
function config(){
 const keyHex=process.env.INTEGRATION_ENCRYPTION_KEY||'';
 const key=/^[a-fA-F0-9]{64}$/.test(keyHex)?Buffer.from(keyHex,'hex'):undefined;
 const origin=process.env.WEB_ORIGIN||'http://localhost:5173';
 return {key,oauth:{clientId:process.env.GOOGLE_INTEGRATIONS_CLIENT_ID||'',
  clientSecret:process.env.GOOGLE_INTEGRATIONS_CLIENT_SECRET||'',
  redirectUri:new URL('/api/v1/integrations/google-calendar/callback',origin).toString(),
  enabled:process.env.GOOGLE_CALENDAR_ENABLED==='true'&&!!key}};
}
@Module({
 controllers:[GoogleConnectionController],
 providers:[{provide:GoogleCalendarConnection,useFactory:()=>{
  const {key,oauth}=config();
  return new GoogleCalendarConnection(new PrismaGoogleConnection(),new PrismaMembershipAdapter(),new GoogleOAuth(oauth),new OAuthCrypto(key));
 }},{provide:ExportClassToCalendar,useFactory:()=>{
  const {key,oauth}=config();
  return new ExportClassToCalendar(new PrismaCalendarExport(),new GoogleCalendarEvents(oauth),new OAuthCrypto(key));
 }}],
})
export class IntegrationsModule{}
