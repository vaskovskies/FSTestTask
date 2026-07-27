import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private client: MongoClient;
  private db: Db;
  private readonly logger = new Logger(MongoService.name);

  constructor(private readonly configService: AppConfigService) {}

  async onModuleInit() {
    const mongoUri = this.configService.mongoUri;
    const dbName = this.configService.mongoDbName;

    this.logger.log(`Connecting to MongoDB at ${mongoUri}`);
    this.client = new MongoClient(mongoUri);
    await this.client.connect();
    this.db = this.client.db(dbName);
    this.logger.log(`Successfully connected to MongoDB database: ${dbName}`);
  }

  async onModuleDestroy() {
    if (this.client) {
      this.logger.log('Closing MongoDB connection...');
      await this.client.close();
      this.logger.log('MongoDB connection closed.');
    }
  }

  getDb(): Db {
    return this.db;
  }
}
