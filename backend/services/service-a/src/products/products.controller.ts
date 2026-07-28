import { Controller, Get, Post, Query, Body, UseInterceptors, UploadedFile, BadRequestException, StreamableFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { SearchProductDto } from './dto/search-product.dto';

@ApiTags('Products')
@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('fetch-and-save')
  @ApiOperation({ summary: 'Fetch products from dummyjson.com API and download as JSON/Excel file (Bonus 1)' })
  @ApiQuery({ name: 'format', enum: ['json', 'excel'], required: false })
  async fetchAndSave(@Query('format') format: 'json' | 'excel' = 'json') {
    const { buffer, fileName, mimeType } = await this.productsService.fetchAndGenerateData(format);
    return new StreamableFile(buffer, {
      type: mimeType,
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Post('upload-and-import')
  @ApiOperation({ summary: 'Upload & parse JSON/Excel file, then insert/upsert into Mongo robustly (Bonus 2)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        format: {
          type: 'string',
          enum: ['json', 'excel'],
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowedMimes = [
          'application/json',
          'text/plain',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        if (!allowedMimes.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              `Unsupported file type ${file.mimetype}. Allowed: JSON, Excel (.xlsx)`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadAndImport(
    @UploadedFile() file: Express.Multer.File,
    @Body('format') format?: 'json' | 'excel',
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const detectedFormat: 'json' | 'excel' =
      format || (file.originalname.toLowerCase().endsWith('.xlsx') ? 'excel' : 'json');
    return this.productsService.uploadAndImportFile(file.buffer, detectedFormat);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search products with text indexing, filters, and efficient pagination' })
  async search(@Query() dto: SearchProductDto) {
    return this.productsService.searchProducts(dto);
  }
}
