import {Module} from '@nestjs/common';
import {SaasController} from './presentation/saas.controller.js';
import {SaasUseCases} from './application/use-cases.js';
import {PrismaSaasRepository} from './infrastructure/prisma-saas-repository.js';
import {quotasEnabled} from './infrastructure/plan-policy.js';
@Module({
 controllers:[SaasController],
 providers:[{provide:SaasUseCases,useFactory:()=>new SaasUseCases(
  new PrismaSaasRepository(new Set((process.env.ACADEMY_PLATFORM_OPERATOR_IDS||'').split(',').map(x=>x.trim()).filter(Boolean))),quotasEnabled(),
 )}],
})
export class SaasModule{}
