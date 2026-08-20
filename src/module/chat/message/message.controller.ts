import {
    Controller,
    Get,
    Post,
    Body,
    UseGuards,
    Query,
    Req
} from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { MessageService } from './message.service';
import { CustomerSendMessageDto } from './dto/customer-send-message.dto';
import { AdminReplyDto } from './dto/admin-reply.dto';
import { GetConversationsDto } from './dto/get-conversations.dto';
import { GetThreadDto } from './dto/get-thread.dto';
import { Message } from './entities/message.entity';
import { Conversation } from '../conversation/entities/conversation.entity';
import { EnrichedConversation } from '../conversation/type/conversation.type';

interface AuthenticatedUser {
    id: string;
    email: string;
    role: Role;
    name: string;
}

interface AuthenticatedRequest extends Request {
    user: AuthenticatedUser;
}

@Controller({ path: 'message', version: CONFIG.API_VERSION })
export class MessageController {
    constructor(private readonly service: MessageService) { }

    /**
     * Customer sends message from floating chat button.
     * Accessible by any authenticated user.
     * Rate limited to 10 messages per minute to prevent spamming.
     */
    @UseGuards(JwtAuthGuard, ThrottlerGuard)
    @Throttle({ default: { limit: 10, ttl: 60000 } })
    @Post('send')
    async sendCustomerMessage(
        @Req() req: AuthenticatedRequest,
        @Body() dto: CustomerSendMessageDto
    ): Promise<ApiResponse<Message>> {
        return await this.service.sendCustomerMessage(req.user.id, dto);
    }

    /**
     * Admin replies to a conversation thread from the admin dashboard.
     * Strictly restricted to ADMIN role.
     */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post('reply')
    async replyByAdmin(
        @Req() req: AuthenticatedRequest,
        @Body() dto: AdminReplyDto
    ): Promise<ApiResponse<Message>> {
        return await this.service.replyByAdmin(req.user.id, dto);
    }

    /**
     * Admin messenger inbox — lists all conversations sorted by latest message with pagination.
     * Strictly restricted to ADMIN role.
     */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get('conversations')
    async getAdminConversations(
        @Query() dto: GetConversationsDto
    ): Promise<ApiResponse<{
        data: EnrichedConversation[];
        total: number;
        page: number;
        limit: number;
        pageCount: number;
    }>> {
        return await this.service.getAdminConversations(dto);
    }

    /**
     * Customer fetches their own active conversation with the latest 50 messages.
     * Accessible by any authenticated user for their own chat.
     */
    @UseGuards(JwtAuthGuard)
    @Get('my-conversation')
    async getMyConversation(
        @Req() req: AuthenticatedRequest
    ): Promise<ApiResponse<{
        conversation: Conversation | null;
        messages: Message[];
    }>> {
        return await this.service.getMyConversation(req.user.id);
    }

    /**
     * View thread messages with cursor pagination (Messenger / WhatsApp style infinite scroll up).
     * Accessible by ADMIN (any thread) and the user who owns the thread.
     */
    @UseGuards(JwtAuthGuard)
    @Get('thread')
    async getThreadMessages(
        @Req() req: AuthenticatedRequest,
        @Query() dto: GetThreadDto
    ): Promise<ApiResponse<Message[]>> {
        return await this.service.getThreadMessages(req.user, dto);
    }
}
