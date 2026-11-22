import { Module } from '@nestjs/common';
import { DemoController } from './controllers/demo.controller.js';

@Module({ controllers: [DemoController] })
export class AppModule {}
