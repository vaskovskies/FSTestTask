import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

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

  async addTimeSeriesSample(key: string, value: number, timestamp: number = Date.now()): Promise<void> {
    try {
      await this.client.call('TS.ADD', key, timestamp, value, 'RETENTION', '86400000', 'ON_DUPLICATE', 'SUM');
    } catch (err: any) {
      this.logger.warn(`TS.ADD failed for key ${key}: ${err.message}`);
    }
  }

  async fetchTimeSeriesRange(
    key: string,
    startTs: number,
    endTs: number,
    aggregation: 'SUM' | 'AVG' | 'MIN' | 'MAX' = 'SUM',
  ): Promise<{ xValues: Date[]; yValues: number[] }> {
    const xValues: Date[] = [];
    const yValues: number[] = [];

    try {
      const result: any = await this.client.call(
        'TS.RANGE',
        key,
        startTs,
        endTs,
        'AGGREGATION',
        aggregation,
        3600000,
      );

      if (!result || !Array.isArray(result)) {
        return { xValues, yValues };
      }

      for (const item of result) {
        const tuple = item as [number, string];
        if (!tuple || tuple.length !== 2) continue;
        const ts = Number(tuple[0]);
        const val = parseFloat(tuple[1] as string) || 0;
        xValues.push(new Date(ts));
        yValues.push(val);
      }
    } catch (err: any) {
      this.logger.warn(`TS.RANGE failed for key ${key}: ${err.message}`);
    }

    return { xValues, yValues };
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    const subscriber = this.client.duplicate();

    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        callback(message);
      }
    });

    await subscriber.subscribe(channel);
    this.logger.log(`Subscribed to Redis Pub/Sub channel: ${channel}`);
  }
}
