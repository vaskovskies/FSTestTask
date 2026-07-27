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
  @UseInterceptors(FileInterceptor('file'))
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
