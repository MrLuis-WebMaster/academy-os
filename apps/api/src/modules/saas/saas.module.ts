import {Module} from '@nestjs/common';
import {BillingController} from './presentation/billing.controller.js';
import {BillingUseCases} from './application/billing-use-cases.js';
import {PrismaBillingRepository} from './infrastructure/prisma-billing-repository.js';
import {priceCatalog} from './domain/billing.js';
const operatorIds=()=>new Set((process.env.ACADEMY_PLATFORM_OPERATOR_IDS||'').split(',').map(x=>x.trim()).filter(Boolean));
import {SaasController} from './presentation/saas.controller.js';
import {SaasUseCases} from './application/use-cases.js';
import {PrismaSaasRepository} from './infrastructure/prisma-saas-repository.js';
import {quotasEnabled} from './infrastructure/plan-policy.js';
@Module({
 controllers:[SaasController,BillingController],
 providers:[{provide:BillingUseCases,useFactory:()=>new BillingUseCases(new PrismaBillingRepository(operatorIds()),priceCatalog({PRO_MONTHLY:process.env.ACADEMY_PRO_MONTHLY_COP,PRO_YEARLY:process.env.ACADEMY_PRO_YEARLY_COP,ACADEMY_MONTHLY:process.env.ACADEMY_ACADEMY_MONTHLY_COP,ACADEMY_YEARLY:process.env.ACADEMY_ACADEMY_YEARLY_COP}),process.env.ACADEMY_SAAS_BILLING_ENABLED==='true')},{provide:SaasUseCases,useFactory:()=>new SaasUseCases(
  new PrismaSaasRepository(operatorIds()),quotasEnabled(),
 )}],
})
export class SaasModule{}
