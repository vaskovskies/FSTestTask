import { Controller, Get, HttpCode, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MongoService } from '../database/mongo.service';
import { RedisTimeSeriesService } from '../redis/redis-timeseries.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly mongoService: MongoService,
    private readonly redisService: RedisTimeSeriesService,
  ) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'Deep health check with Mongo and Redis pings' })
  async check() {
    const [mongoUp, redisUp] = await Promise.all([
      this.mongoService.ping(),
      this.redisService.ping(),
    ]);

    const status = { status: 'ok', mongo: mongoUp, redis: redisUp };

    if (!mongoUp || !redisUp) {
      throw new ServiceUnavailableException(status);
    }

    return status;
  }
}
