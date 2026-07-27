import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  async onModuleInit() {
    const mm: any = await import('migrate-mongo');
    const migrateConfig = await mm.config;
    const database = await mm.database;
    const up = await mm.up;

    const configModule: any = await import('../../migrate-mongo-config');
    migrateConfig.set(configModule.default || configModule);

    const { db, client } = await database.connect();

    try {
      const migrated = await up(db, client);

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
