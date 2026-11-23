/** Branded install metadata is derived only from an explicitly published studio. */
export interface PublicAcademyBrand {
 name:string;slug:string;brandColor:string;
}
function hexColor(value:string){
 return /^#[0-9a-fA-F]{6}$/.test(value)?value.toLowerCase():'#7059e8';
}
function escapeXml(value:string){
 return value.replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;',
 }[char]??''));
}
export function publicAcademyManifest(academy:PublicAcademyBrand){
 const slug=academy.slug;
 const start='/academy/'+encodeURIComponent(slug)+'/';
 const name=academy.name.trim().slice(0,80)||'Mi academia';
 return {
  id:start,
  name,
  short_name:name.slice(0,24),
  description:'Mi espacio de aprendizaje',
  start_url:start,
  scope:start,
  display:'standalone',
  background_color:'#f8f9fc',
  theme_color:hexColor(academy.brandColor),
  lang:'es',
  icons:[{
   src:'/api/v1/studio/public/'+encodeURIComponent(slug)+'/app-icon.svg',
   sizes:'any',type:'image/svg+xml',purpose:'any maskable',
  }],
 };
}
/** First-party, deterministic SVG icon; never embeds third-party logo URLs. */
export function publicAcademyIcon(academy:PublicAcademyBrand){
 const name=academy.name.trim()||'Academia';
 const initials=[...name.split(/\s+/).slice(0,2).map(part=>part.slice(0,1).toUpperCase())].join('').slice(0,2);
 const color=hexColor(academy.brandColor);
 return '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">'
  +'<rect width="192" height="192" rx="42" fill="'+color+'"/>'
  +'<text x="96" y="115" text-anchor="middle" font-family="Arial,sans-serif"'
  +' font-size="70" font-weight="700" fill="#ffffff">'+escapeXml(initials)+'</text></svg>';
}
