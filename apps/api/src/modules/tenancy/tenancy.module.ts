import {Module} from '@nestjs/common';
import {WorkspaceController} from './presentation/workspaces.controller.js';
import {WorkspaceProvisionUseCases} from './application/workspace-provision-use-cases.js';
import {PrismaWorkspaceProvisionRepository} from './infrastructure/prisma-workspace-provision-repository.js';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {InvitationUseCases} from './application/invitation-use-cases.js';
import {PrismaInvitationRepository} from './infrastructure/prisma-invitation-repository.js';
import {SecureInvitationToken} from './infrastructure/secure-invitation-token.js';
import {InvitationsController} from './presentation/invitations.controller.js';

@Module({
  controllers:[WorkspaceController,InvitationsController],
  providers:[{
    provide:WorkspaceProvisionUseCases,
    useFactory:()=>new WorkspaceProvisionUseCases(new PrismaWorkspaceProvisionRepository()),
  },{
    provide:InvitationUseCases,
    useFactory:()=>new InvitationUseCases(
      new PrismaInvitationRepository(),new PrismaMembershipAdapter(),new SecureInvitationToken(),
    ),
  }],
})
export class TenancyModule {}
