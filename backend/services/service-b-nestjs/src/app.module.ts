import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { MongoService } from './database/mongo.service';
import { RedisService } from './redis/redis.service';
import { LogsController } from './logs/logs.controller';
import { LogsService } from './logs/logs.service';
import { LogsRepository } from './logs/logs.repository';
import { HealthController } from './health/health.controller';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';

@Module({
  imports: [AppConfigModule],
  controllers: [LogsController, HealthController, ReportsController],
  providers: [
    MongoService,
    RedisService,
    LogsRepository,
    LogsService,
    ReportsService,
  ],
})
export class AppModule {}
