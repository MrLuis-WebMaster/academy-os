import {Module} from '@nestjs/common';
import {PaymentEventsController} from './presentation/payment-events.controller.js';
import {PaymentEventManagement} from './application/payment-event-inbox.js';
import {PrismaPaymentEventInbox} from './infrastructure/prisma-payment-event-inbox.js';
import {CheckoutController} from './presentation/checkout.controller.js';
import {CheckoutUseCases} from './application/checkout-use-cases.js';
import {PrismaPackageCheckoutRepository} from './infrastructure/prisma-package-checkout-repository.js';
import {configuredWorkspaceMerchants} from './infrastructure/prisma-wompi-merchants.js';
import {MerchantController} from './presentation/merchant.controller.js';
import {MerchantUseCases} from './application/merchant-use-cases.js';
import {PackageOrdersController} from './presentation/package-orders.controller.js';
import {PackageOrderUseCases} from './application/order-use-cases.js';
import {PrismaPackageOrderRepository} from './infrastructure/prisma-package-order-repository.js';
import {ClassPackagesController} from './presentation/packages.controller.js';
import {ClassPackagesUseCases} from './application/package-use-cases.js';
import {PrismaClassPackagesRepository} from './infrastructure/prisma-class-packages-repository.js';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {StudioUseCases} from './application/studio-use-cases.js';
import {PrismaStudioRepository} from './infrastructure/prisma-studio-repository.js';
import {StudioController} from './presentation/studio.controller.js';

@Module({
  controllers:[StudioController,ClassPackagesController,PackageOrdersController,CheckoutController,MerchantController,PaymentEventsController],
  providers:[{
    provide:CheckoutUseCases,
    useFactory:()=>{const merchants=configuredWorkspaceMerchants();return new CheckoutUseCases(new PrismaPackageCheckoutRepository(),merchants.legacy(),new PrismaMembershipAdapter(),merchants,process.env.ACADEMY_PAYMENT_INBOX_ENABLED==='true'?new PrismaPaymentEventInbox():undefined);},
  },{
    provide:PaymentEventManagement,
    useFactory:()=>new PaymentEventManagement(new PrismaPaymentEventInbox(),new PrismaMembershipAdapter()),
  },{
    provide:MerchantUseCases,
    useFactory:()=>new MerchantUseCases(configuredWorkspaceMerchants(),new PrismaMembershipAdapter()),
  },{
    provide:PackageOrderUseCases,
    useFactory:()=>new PackageOrderUseCases(new PrismaPackageOrderRepository(),new PrismaMembershipAdapter(),process.env.ACADEMY_PACKAGE_ORDERS_ENABLED==='true'),
  },{
    provide:ClassPackagesUseCases,
    useFactory:()=>new ClassPackagesUseCases(new PrismaClassPackagesRepository(),new PrismaMembershipAdapter()),
  },{
    provide:StudioUseCases,
    useFactory:()=>new StudioUseCases(new PrismaStudioRepository(),new PrismaMembershipAdapter()),
  }],
})
export class CommerceModule {}
