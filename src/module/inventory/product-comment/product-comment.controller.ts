import {
    Controller, Post, Get, Patch, Delete, Body, Param, Query, Req, UseGuards, ParseUUIDPipe
} from '@nestjs/common';
import { CONFIG } from '../../../utils/config';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/role.guard';
import { Roles } from '../../../decorators/role.decorator';
import { Role } from '../../../enums/role.enum';
import { Public } from '../../../decorators/public.decorator';
import { CreateProductCommentDto } from './dto/create-product-comment.dto';
import { UpdateProductCommentDto } from './dto/update-product-comment.dto';
import { CommentFilterDto } from './dto/comment-filter.dto';
import { Request } from 'express';
import { ProductCommentService } from './product-comment.service';
import { CommentNode } from './types/comment-node.type';
import { ApiResponse } from '../../../utils/response.utils';

@Controller({ path: 'product-comment', version: CONFIG.API_VERSION })
export class ProductCommentController {
    constructor(private readonly service: ProductCommentService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.CUSTOMER, Role.VENDOR)
    @Post()
    create(@Body() dto: CreateProductCommentDto, @Req() req: Request) {
        return this.service.create(dto, req.user);
    }

    @Public()
    @Get('product/:productId')
    listForProduct(
        @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
        @Query() dto: CommentFilterDto
    ): Promise<ApiResponse<{ data: CommentNode[]; total: number; page: number; limit: number; pageCount: number }>> {
        return this.service.listForProduct(productId, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get('all')
    findAll(
        @Query() dto: CommentFilterDto
    ): Promise<ApiResponse<{ data: CommentNode[]; total: number; page: number; limit: number; pageCount: number }>> {
        return this.service.findAll(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.CUSTOMER)
    @Patch(':commentId')
    update(
        @Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string,
        @Body() dto: UpdateProductCommentDto,
        @Req() req: Request
    ) {
        return this.service.update(commentId, dto, req.user);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Delete(':commentId')
    remove(@Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string) {
        return this.service.remove(commentId);
    }
}
