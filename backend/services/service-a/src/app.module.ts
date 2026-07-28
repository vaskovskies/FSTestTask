import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { MongoService } from './database/mongo.service';
import { RedisTimeSeriesService } from './redis/redis-timeseries.service';
import { MigrationService } from './migrations/migration.service';
import { ProductsRepository } from './products/products.repository';
import { ProductsService } from './products/products.service';
import { ProductsController } from './products/products.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [AppConfigModule],
  controllers: [ProductsController, HealthController],
  providers: [
    MongoService,
    RedisTimeSeriesService,
    MigrationService,
    ProductsRepository,
    ProductsService,
  ],
})
export class AppModule {}
