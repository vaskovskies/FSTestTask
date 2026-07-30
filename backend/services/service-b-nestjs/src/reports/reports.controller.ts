import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('pdf')
  @ApiOperation({ summary: 'Generate a PDF report from all Redis TimeSeries metrics' })
  @ApiQuery({ name: 'start', required: false, description: 'Start timestamp in milliseconds (defaults to 24h ago)' })
  @ApiQuery({ name: 'end', required: false, description: 'End timestamp in milliseconds (defaults to now)' })
  async generatePdfReport(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const startTs = start ? parseInt(start, 10) : 0;
    const endTs = end ? parseInt(end, 10) : 0;

    const { pdfBuffer, filename } = await this.reportsService.generatePdfReport(startTs, endTs);

    return new StreamableFile(pdfBuffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
