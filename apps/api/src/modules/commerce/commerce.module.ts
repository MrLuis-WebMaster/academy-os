import {Module} from '@nestjs/common';
import {CheckoutController} from './presentation/checkout.controller.js';
import {CheckoutUseCases} from './application/checkout-use-cases.js';
import {PrismaPackageCheckoutRepository} from './infrastructure/prisma-package-checkout-repository.js';
import {configuredWompi} from './infrastructure/wompi-config.js';
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
  controllers:[StudioController,ClassPackagesController,PackageOrdersController,CheckoutController],
  providers:[{
    provide:CheckoutUseCases,
    useFactory:()=>new CheckoutUseCases(new PrismaPackageCheckoutRepository(),configuredWompi(),new PrismaMembershipAdapter()),
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
