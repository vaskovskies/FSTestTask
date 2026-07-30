import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { ServiceBClient } from './service-b.client';

@Module({
  imports: [AppConfigModule],
  providers: [ServiceBClient],
  exports: [ServiceBClient],
})
export class ServiceBModule {}
