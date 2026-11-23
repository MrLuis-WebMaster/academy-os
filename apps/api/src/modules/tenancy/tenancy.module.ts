import {Module} from '@nestjs/common';
import {GuardiansController} from './presentation/guardians.controller.js';
import {GuardianUseCases} from './application/guardian-use-cases.js';
import {PrismaGuardianRepository} from './infrastructure/prisma-guardian-repository.js';
import {WorkspaceDirectoryController} from './presentation/workspace-directory.controller.js';
import {WorkspaceDirectoryUseCases} from './application/workspace-directory.js';
import {PrismaWorkspaceDirectory} from './infrastructure/prisma-workspace-directory.js';
import {WorkspaceController} from './presentation/workspaces.controller.js';
import {WorkspaceProvisionUseCases} from './application/workspace-provision-use-cases.js';
import {PrismaWorkspaceProvisionRepository} from './infrastructure/prisma-workspace-provision-repository.js';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {InvitationUseCases} from './application/invitation-use-cases.js';
import {PrismaInvitationRepository} from './infrastructure/prisma-invitation-repository.js';
import {SecureInvitationToken} from './infrastructure/secure-invitation-token.js';
import {InvitationsController} from './presentation/invitations.controller.js';

@Module({
  controllers:[GuardiansController,WorkspaceDirectoryController,WorkspaceController,InvitationsController],
  providers:[{
    provide:GuardianUseCases,
    useFactory:()=>new GuardianUseCases(new PrismaGuardianRepository(),new PrismaMembershipAdapter()),
  },{
    provide:WorkspaceDirectoryUseCases,
    useFactory:()=>new WorkspaceDirectoryUseCases(new PrismaWorkspaceDirectory(),new PrismaMembershipAdapter()),
  },{
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
