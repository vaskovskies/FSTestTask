import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import * as PDFDocument from 'pdfkit';

interface MetricDef {
  key: string;
  label: string;
  unit: string;
  chartName: string;
}

interface MetricData {
  def: MetricDef;
  xValues: Date[];
  yValues: number[];
  total: number;
  avg: number;
  max: number;
  min: number;
  count: number;
}

const ALL_METRICS: MetricDef[] = [
  { key: 'ts:api_fetch_count', label: 'API Fetch Count', unit: 'Products', chartName: 'API Fetched Products' },
  { key: 'ts:products_ingested_count', label: 'Products Ingested Count', unit: 'Products', chartName: 'Products Ingested via File Import' },
  { key: 'ts:search_queries', label: 'Search Queries', unit: 'Queries', chartName: 'Search Query Count' },
  { key: 'ts:search_latency_ms', label: 'Search Latency', unit: 'ms', chartName: 'Search Latency (ms)' },
];

const PAGE_MARGIN = 40;
const PAGE_BOTTOM_MARGIN = 60;

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly redisService: RedisService) {}

  async generatePdfReport(startTs: number, endTs: number): Promise<{ pdfBuffer: Buffer; filename: string }> {
    if (startTs <= 0) {
      startTs = Date.now() - 24 * 60 * 60 * 1000;
    }
    if (endTs <= 0) {
      endTs = Date.now();
    }

    const filename = `report_${Date.now()}.pdf`;
    const allData: MetricData[] = [];
    let hasData = false;

    for (const def of ALL_METRICS) {
      const data = await this.fetchMetric(def, startTs, endTs);
      if (data.count > 0) hasData = true;
      allData.push(data);
    }

    const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    this.addHeader(doc);
    this.addSummaryTable(doc, allData);

    if (!hasData) {
      this.checkPageOverflow(doc, 60);
      doc.fontSize(16);
      doc.font('Helvetica-BoldOblique');
      doc.fillColor('#b4b4b4');
      doc.text('No Data Available for any metric in the selected time range', {
        align: 'center',
      });
      doc.fillColor('#000000');
    } else {
      doc.x = PAGE_MARGIN;
      for (let i = 0; i < allData.length; i++) {
        const data = allData[i];
        if (data.count < 2) {
          this.checkPageOverflow(doc, 100);
          this.addMetricSectionNoData(doc, data.def);
        } else {
          this.checkPageOverflow(doc, 280);
          this.addMetricSection(doc, data.def, data);
        }
        if (i < allData.length - 1) {
          this.addSeparator(doc);
        }
      }
    }

    this.addFooter(doc);
    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve({ pdfBuffer: Buffer.concat(buffers), filename });
      });
    });
  }

  private checkPageOverflow(doc: typeof PDFDocument.prototype, neededSpace: number) {
    if (doc.y + neededSpace > doc.page.height - PAGE_BOTTOM_MARGIN) {
      doc.addPage();
    }
  }

  private async fetchMetric(def: MetricDef, startTs: number, endTs: number): Promise<MetricData> {
    const { xValues, yValues } = await this.redisService.fetchTimeSeriesRange(def.key, startTs, endTs);

    let total = 0;
    let maxVal = -Infinity;
    let minVal = Infinity;

    for (const v of yValues) {
      total += v;
      if (v > maxVal) maxVal = v;
      if (v < minVal) minVal = v;
    }

    const count = yValues.length;

    return {
      def,
      xValues,
      yValues,
      total,
      avg: count > 0 ? total / count : 0,
      max: count > 0 ? maxVal : 0,
      min: count > 0 ? minVal : 0,
      count,
    };
  }

  private addHeader(doc: typeof PDFDocument.prototype) {
    this.checkPageOverflow(doc, 80);

    doc.fontSize(18);
    doc.font('Helvetica-Bold');
    doc.text('Lumana Analytics & TimeSeries Report', { align: 'center' });

    doc.fontSize(10);
    doc.font('Helvetica');
    doc.text(`Generated At: ${new Date().toUTCString()} | All Metrics`, { align: 'center' });

    doc.moveDown(0.8);
    this.drawLine(doc, 1);
    doc.moveDown(0.8);
  }

  private addSummaryTable(doc: typeof PDFDocument.prototype, allData: MetricData[]) {
    this.checkPageOverflow(doc, 200);

    doc.x = PAGE_MARGIN;
    doc.fontSize(14);
    doc.font('Helvetica-Bold');
    doc.text('Metrics Summary', { align: 'left' });
    doc.moveDown(0.5);

    const colStarts = [PAGE_MARGIN, 170, 270, 340, 410, 470, 530];
    const colWidths = [130, 100, 70, 70, 60, 60, 60];
    const headers = ['Metric', 'Samples', 'Total', 'Avg', 'Max', 'Min'];
    const rowHeight = 12;
    const labelFontSize = 9;
    const dataFontSize = 8;

    let rowY = doc.y;
    doc.fontSize(labelFontSize);
    doc.font('Helvetica-Bold');
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], colStarts[i + 1], rowY, {
        width: colWidths[i + 1],
        align: i === 0 ? 'left' : 'center',
      });
    }

    rowY += rowHeight;
    this.drawLineAt(doc, rowY, 0.5);
    rowY += 6;

    doc.font('Helvetica');
    doc.fontSize(dataFontSize);
    for (const data of allData) {
      const samples = data.count > 0 ? `${data.count}` : '0';
      const total = data.count > 0 ? `${data.total.toFixed(1)}` : '-';
      const avg = data.count > 0 ? `${data.avg.toFixed(2)}` : '-';
      const maxStr = data.count > 0 ? `${data.max.toFixed(1)}` : '-';
      const minStr = data.count > 0 ? `${data.min.toFixed(1)}` : '-';

      doc.text(data.def.label, colStarts[1], rowY, { width: colWidths[1] });
      doc.text(samples, colStarts[2], rowY, { width: colWidths[2], align: 'center' });
      doc.text(total, colStarts[3], rowY, { width: colWidths[3], align: 'center' });
      doc.text(avg, colStarts[4], rowY, { width: colWidths[4], align: 'center' });
      doc.text(maxStr, colStarts[5], rowY, { width: colWidths[5], align: 'center' });
      doc.text(minStr, colStarts[6], rowY, { width: colWidths[6], align: 'center' });

      rowY += rowHeight;
    }

    this.drawLineAt(doc, rowY, 0.5);
    doc.y = rowY + 10;
  }

  private addMetricSection(doc: typeof PDFDocument.prototype, def: MetricDef, data: MetricData) {
    doc.x = PAGE_MARGIN;
    doc.fontSize(13);
    doc.font('Helvetica-Bold');
    doc.text(`Metric: ${def.label} (${def.key})`);
    doc.moveDown(0.5);

    this.drawBarChart(doc, def, data);

    doc.moveDown(0.5);
  }

  private addMetricSectionNoData(doc: typeof PDFDocument.prototype, def: MetricDef) {
    doc.x = PAGE_MARGIN;
    doc.fontSize(13);
    doc.font('Helvetica-Bold');
    doc.text(`Metric: ${def.label} (${def.key})`);
    doc.moveDown(0.5);

    doc.fontSize(14);
    doc.font('Helvetica-BoldOblique');
    doc.fillColor('#b4b4b4');
    doc.text('No Data Available for this metric in the selected time range', { align: 'center' });
    doc.fillColor('#000000');

    doc.moveDown(0.5);
  }

  private drawBarChart(doc: typeof PDFDocument.prototype, def: MetricDef, data: MetricData) {
    const chartLeft = 60;
    const chartTop = doc.y;
    const chartWidth = doc.page.width - chartLeft - PAGE_MARGIN;
    const chartHeight = 200;
    const barPadding = 2;

    const maxVal = data.max > 0 ? data.max : 1;
    const count = data.yValues.length;
    const barAreaHeight = chartHeight - 60;
    const barAreaBottom = chartTop + chartHeight - 20;
    const barAreaTop = barAreaBottom - barAreaHeight;
    const barWidth = Math.max(4, Math.min(30, (chartWidth - 60) / Math.max(count, 1) - barPadding));
    const margin = 10;

    doc.fontSize(9);
    doc.font('Helvetica');
    doc.text(`${def.chartName} (${def.unit})`, chartLeft, chartTop, { align: 'center' });

    // Draw Y-axis
    doc.rect(chartLeft + margin, barAreaTop, 1, barAreaHeight).stroke('#333333');
    // Draw X-axis
    doc.rect(chartLeft + margin, barAreaBottom, chartWidth - margin, 1).stroke('#333333');

    // Y-axis labels and grid lines
    doc.fontSize(7);
    doc.font('Helvetica');
    for (let i = 0; i <= 4; i++) {
      const val = (maxVal * i) / 4;
      const y = barAreaBottom - barAreaHeight * (i / 4);

      doc.text(val.toFixed(1), chartLeft - 5, y - 3, { width: 35, align: 'right' });

      // Grid line
      doc.rect(chartLeft + margin + 1, y, chartWidth - margin, 0.3).fill('#e0e0e0');
    }

    // Draw bars
    const drawStartX = chartLeft + margin + 10;
    for (let i = 0; i < count; i++) {
      const barH = (data.yValues[i] / maxVal) * barAreaHeight;
      const x = drawStartX + i * (barWidth + barPadding);
      const y = barAreaBottom - barH;

      doc.rect(x, y, barWidth, barH).fill('#3b82f6');
    }

    // Time labels (show a few evenly spaced)
    doc.fontSize(6);
    doc.font('Helvetica');
    const maxLabels = Math.min(count, Math.floor((chartWidth - margin) / 50));
    const labelStep = Math.max(1, Math.floor(count / maxLabels));
    for (let i = 0; i < count; i += labelStep) {
      const x = drawStartX + i * (barWidth + barPadding) + barWidth / 2 - 12;
      const label = data.xValues[i].toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      doc.text(label, x, barAreaBottom + 5, { width: 24, align: 'center' });
    }

    doc.x = PAGE_MARGIN;
    doc.y = barAreaBottom + 25;
  }

  private addSeparator(doc: typeof PDFDocument.prototype) {
    this.drawLine(doc, 0.3);
    doc.moveDown(0.5);
  }

  private addFooter(doc: typeof PDFDocument.prototype) {
    this.checkPageOverflow(doc, 40);
    this.drawLine(doc, 0.5);
    doc.x = PAGE_MARGIN;
    doc.fontSize(9);
    doc.font('Helvetica');
    doc.text('Report verified and automatically compiled by Service B (NestJS)', { align: 'left' });
  }

  private drawLine(doc: typeof PDFDocument.prototype, thickness: number) {
    doc.rect(PAGE_MARGIN, doc.y, doc.page.width - 2 * PAGE_MARGIN, thickness).fill('#000000');
  }

  private drawLineAt(doc: typeof PDFDocument.prototype, y: number, thickness: number) {
    doc.rect(PAGE_MARGIN, y, doc.page.width - 2 * PAGE_MARGIN, thickness).fill('#000000');
  }
}
