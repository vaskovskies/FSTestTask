import { Module, OnModuleInit } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { MongoService } from './database/mongo.service';
import { RedisTimeSeriesService } from './redis/redis-timeseries.service';
import { MigrationRunner } from './migrations/runner';
import { ProductsRepository } from './products/products.repository';
import { ProductsService } from './products/products.service';
import { ProductsController } from './products/products.controller';

@Module({
  imports: [AppConfigModule],
  controllers: [ProductsController],
  providers: [
    MongoService,
    RedisTimeSeriesService,
    MigrationRunner,
    ProductsRepository,
    ProductsService,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly migrationRunner: MigrationRunner) {}

  async onModuleInit() {
    await this.migrationRunner.runMigrations();
  }
}
