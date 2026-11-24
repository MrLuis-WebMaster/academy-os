/**
 * Local export of the already-authorized administrative credit issuance read model.
 * Export contains only the 200 records supplied by the protected endpoint; it does
 * not make a second request or claim to be a complete financial ledger.
 */
export type CreditAuditExportRow = {
 id:string;
 credits:number;
 used:number;
 remaining:number;
 available:number;
 issuedAt:string;
 expiresAt:string;
 revokedAt:string|null;
 revokeReason:string|null;
 futureBookings:number;
 package:{title:string;courseId:string|null;priceCOP:number};
 student:{name:string};
 issuer:{name:string};
};

const HEADERS=[
 'ID asignación','Alumno','Paquete','Curso ID','Emisor','Créditos emitidos',
 'Créditos consumidos','Saldo registrado','Créditos disponibles','Reservas futuras',
 'Precio de referencia COP','Emisión (UTC)','Vencimiento (UTC)',
 'Revocación (UTC)','Motivo de revocación',
] as const;

function csvCell(value:unknown):string {
 // Spreadsheet applications may execute formulas even in quoted CSV fields.
 // Prefix risky, user-controlled text with an apostrophe before quoting.
 const raw=String(value??'');
 const safe=/^[\s\uFEFF\u200B]*[=+\-@]/u.test(raw) || /^[\t\r\n]/u.test(raw)
  ? "'"+raw : raw;
 return '"'+safe.replaceAll('"','""')+'"';
}
function iso(value:string|null):string {
 if(!value)return '';
 const parsed=new Date(value);
 return Number.isFinite(parsed.getTime())?parsed.toISOString():'';
}
export function serializeCreditAuditCsv(rows:readonly CreditAuditExportRow[]):string {
 const records=rows.map(row=>[
  row.id,row.student.name,row.package.title,row.package.courseId??'',
  row.issuer.name,row.credits,row.used,row.remaining,row.available,
  row.futureBookings,row.package.priceCOP,iso(row.issuedAt),
  iso(row.expiresAt),iso(row.revokedAt),row.revokeReason??'',
 ]);
 return '\uFEFF'+[HEADERS,...records].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
export function creditAuditFilename(workspaceId:string,date=new Date()):string {
 const safeId=workspaceId.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64)||'academia';
 const day=date.toISOString().slice(0,10);
 return `academy-os-creditos-${safeId}-${day}.csv`;
}
