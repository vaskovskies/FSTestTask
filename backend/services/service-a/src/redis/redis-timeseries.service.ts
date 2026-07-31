import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class RedisTimeSeriesService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisTimeSeriesService.name);

  constructor(private readonly configService: AppConfigService) {}

  async onModuleInit() {
    const host = this.configService.redisHost;
    const port = this.configService.redisPort;

    this.logger.log(`Connecting to Redis at ${host}:${port}`);
    this.client = new Redis({
      host,
      port,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.client.on('connect', () => this.logger.log('Connected to Redis Stack'));
    this.client.on('error', (err) => this.logger.error('Redis error:', err));
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      this.logger.log('Closing Redis connection...');
      await this.client.quit();
      this.logger.log('Redis connection closed.');
    }
  }

  /**
   * Add a sample point to a RedisTimeSeries key
   */
  async addTimeSeriesSample(key: string, value: number, timestamp: number = Date.now()): Promise<void> {
    try {
      await this.client.call('TS.ADD', key, timestamp, value, 'RETENTION', '86400000', 'ON_DUPLICATE', 'SUM');
    } catch (err: any) {
      this.logger.warn(`TS.ADD failed for key ${key}: ${err.message}`);
    }
  }

  /**
   * Add an event to the Redis Stream for Service B consumers to read
   */
  async publishEvent(action: string, payload: Record<string, any>, level = 'INFO'): Promise<void> {
    const timestamp = Date.now();

    try {
      await this.client.xadd(
        'service_events',
        'MAXLEN', '~', 100000,
        '*',
        'service', 'Service-A',
        'action', action,
        'payload', JSON.stringify(payload),
        'level', level,
        'timestamp', timestamp,
      );
      this.logger.log(`Published event [${action}] to Redis stream service_events`);
    } catch (err: any) {
      this.logger.error(`Failed to publish event [${action}]:`, err.message);
    }
  }
}
