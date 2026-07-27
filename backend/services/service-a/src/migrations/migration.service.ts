import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as migrateMongo from 'migrate-mongo';
import config from '../../migrate-mongo-config';

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  async onModuleInit() {
    migrateMongo.config.set(config);

    const { db, client } = await migrateMongo.database.connect();

    try {
      const migrated = await migrateMongo.up(db, client);

      if (migrated.length === 0) {
        this.logger.log('No pending migrations');
      } else {
        migrated.forEach((fileName) => {
          this.logger.log(`Applied migration: ${fileName}`);
        });
      }
    } catch (err) {
      this.logger.error(`Migration failed: ${err.message}`, err.stack);
    } finally {
      await client.close();
    }
  }
}
