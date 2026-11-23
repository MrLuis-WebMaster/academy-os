import {Module} from '@nestjs/common';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {InvitationUseCases} from './application/invitation-use-cases.js';
import {PrismaInvitationRepository} from './infrastructure/prisma-invitation-repository.js';
import {SecureInvitationToken} from './infrastructure/secure-invitation-token.js';
import {InvitationsController} from './presentation/invitations.controller.js';

@Module({
  controllers:[InvitationsController],
  providers:[{
    provide:InvitationUseCases,
    useFactory:()=>new InvitationUseCases(
      new PrismaInvitationRepository(),new PrismaMembershipAdapter(),new SecureInvitationToken(),
    ),
  }],
})
export class TenancyModule {}
