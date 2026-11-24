import {WompiGateway} from './wompi-gateway.js';
export function configuredWompi(){
 return new WompiGateway({
  enabled:process.env.ACADEMY_WOMPI_ENABLED==='true'&&process.env.ACADEMY_PACKAGE_ORDERS_ENABLED==='true'&&
   (process.env.ACADEMY_WOMPI_ENVIRONMENT!=='prod'||process.env.ACADEMY_WOMPI_LIVE_ENABLED==='true'),
  workspaceId:process.env.ACADEMY_WOMPI_WORKSPACE_ID||'',environment:process.env.ACADEMY_WOMPI_ENVIRONMENT||'test',
  publicKey:process.env.ACADEMY_WOMPI_PUBLIC_KEY||'',privateKey:process.env.ACADEMY_WOMPI_PRIVATE_KEY||'',
  integrityKey:process.env.ACADEMY_WOMPI_INTEGRITY_KEY||'',eventsKey:process.env.ACADEMY_WOMPI_EVENTS_KEY||'',
  issuerId:process.env.ACADEMY_WOMPI_ISSUER_ID||'',webOrigin:process.env.WEB_ORIGIN||'http://localhost:5173',
 });
}
