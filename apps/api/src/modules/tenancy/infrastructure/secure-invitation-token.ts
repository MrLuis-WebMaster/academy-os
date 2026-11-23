import {createHash,randomBytes} from 'node:crypto';
import type {InvitationTokenPort} from '../application/invitation-ports.js';

/** Unsent tokens are never persisted in plaintext: only SHA-256 digests live in PostgreSQL. */
export class SecureInvitationToken implements InvitationTokenPort {
  digest(token:string):string {
    return createHash('sha256').update(token).digest('hex');
  }
  mint(){
    const token=randomBytes(32).toString('base64url');
    return {token,hash:this.digest(token)};
  }
}
