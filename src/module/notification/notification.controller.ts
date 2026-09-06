import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { CONFIG } from '../../utils/config';
import { ApiResponse } from '../../utils/response.utils';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/role.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../enums/role.enum';

@Controller({
  path: 'site/notifications',
  version: CONFIG.API_VERSION,
})
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findUserNotifications(
    @Req() req: Request
  ): Promise<ApiResponse<{ notifications: any[]; unreadCount: number }>> {
    const userId = (req as any)?.user?.id || (req as any)?.user?.userId;
    if (!userId) {
      throw new HttpException('User authentication required.', HttpStatus.UNAUTHORIZED);
    }
    return await this.service.findUserNotifications(userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin')
  async findAdminNotifications(
    @Query('after') after?: string,
    @Query('limit') limit?: string
  ): Promise<ApiResponse<{ items: any[]; unreadCount: number; nextCursor: string | null }>> {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return await this.service.findAdminNotifications(after, limitNum);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/read-all')
  async markAllAdminNotificationsRead(): Promise<ApiResponse<boolean>> {
    return await this.service.markAllAdminNotificationsRead();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/:id/read')
  async markAdminNotificationRead(
    @Param('id') id: string
  ): Promise<ApiResponse<boolean>> {
    return await this.service.markAdminNotificationRead(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('read-all')
  async markAllAsRead(@Req() req: Request): Promise<ApiResponse<boolean>> {
    const userId = (req as any)?.user?.id || (req as any)?.user?.userId;
    if (!userId) {
      throw new HttpException('User authentication required.', HttpStatus.UNAUTHORIZED);
    }
    return await this.service.markAllAsRead(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @Req() req: Request
  ): Promise<ApiResponse<boolean>> {
    const userId = (req as any)?.user?.id || (req as any)?.user?.userId;
    if (!userId) {
      throw new HttpException('User authentication required.', HttpStatus.UNAUTHORIZED);
    }
    return await this.service.markAsRead(id, userId);
  }
}
