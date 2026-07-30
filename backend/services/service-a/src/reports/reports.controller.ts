import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ServiceBClient } from '../service-b/service-b.client';

@ApiTags('Reports')
@Controller('api/reports')
export class ReportsController {
  constructor(private readonly serviceB: ServiceBClient) {}

  @Get('pdf')
  @ApiOperation({ summary: 'Generate a PDF report from Redis TimeSeries data via Service B' })
  @ApiQuery({ name: 'metric', required: false, description: 'Redis TimeSeries metric key', example: 'ts:search_queries' })
  @ApiQuery({ name: 'start', required: false, description: 'Start timestamp in milliseconds' })
  @ApiQuery({ name: 'end', required: false, description: 'End timestamp in milliseconds' })
  async generatePdfReport(
    @Query('metric') metric?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const metricName = metric || 'ts:search_queries';
    const startTimestamp = start ? parseInt(start, 10) : 0;
    const endTimestamp = end ? parseInt(end, 10) : 0;

    const { pdfContent, filename } = await this.serviceB.generateReport(
      metricName,
      startTimestamp,
      endTimestamp,
    );

    return new StreamableFile(pdfContent, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
