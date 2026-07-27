import { Injectable, Logger } from '@nestjs/common';
import { MongoService } from '../database/mongo.service';

@Injectable()
export class MigrationRunner {
  private readonly logger = new Logger(MigrationRunner.name);

  constructor(private readonly mongoService: MongoService) {}

  async runMigrations(): Promise<void> {
    const db = this.mongoService.getDb();
    const collection = db.collection('products');

    this.logger.log('Executing database migrations for products collection...');

    try {
      // 1. Create compound text index on title, description, category, and brand
      await collection.createIndex(
        {
          title: 'text',
          description: 'text',
          category: 'text',
          brand: 'text',
        },
        {
          name: 'products_text_search_idx',
          weights: {
            title: 10,
            brand: 5,
            category: 3,
            description: 1,
          },
          background: true,
        },
      );

      // 2. Create single field index on price and rating for fast sorting/filtering
      await collection.createIndex({ price: 1 }, { background: true });
      await collection.createIndex({ category: 1 }, { background: true });
      await collection.createIndex({ externalId: 1 }, { unique: true, sparse: true, background: true });

      this.logger.log('Database migrations completed successfully!');
    } catch (err: any) {
      this.logger.error(`Migration execution failed: ${err.message}`, err.stack);
    }
  }
}
