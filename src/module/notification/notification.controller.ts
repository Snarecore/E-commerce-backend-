import {
  Controller,
  Get,
  Patch,
  Param,
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
