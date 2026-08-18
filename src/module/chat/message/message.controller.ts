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
import { SendMessageDto } from './dto/send-message.dto';
import { MessageInterface } from './type/message.type';
import { MessageService } from './message.service';
import { Conversation } from '../conversation/entities/conversation.entity';
import { GetMessagesDto } from './dto/get-messages.dto';
import { Message } from './entities/message.entity';
import { ConversationFilterDto } from '../conversation/dto/conversation-filter.dto';
import { EnrichedConversation } from '../conversation/type/conversation.type';

interface AuthenticatedRequest extends Request {
    user: { id: string };
}

@Controller({ path: 'message', version: CONFIG.API_VERSION })
export class MessageController {
    constructor(private readonly service: MessageService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.VENDOR)
    @Post()
    async sendMessage(
        @Body() dto: SendMessageDto
    ): Promise<ApiResponse<MessageInterface>> {
        return await this.service.sendMessage(dto);
    }

    // @Roles(Role.ADMIN, Role.VENDOR)
    // @Get('conversations')
    // async getUserConversations(
    //     @Req() req: AuthenticatedRequest,
    //     @Query() dto: ConversationFilterDto
    // ): Promise<ApiResponse<{data: EnrichedConversation[]; total: number; page: number; limit: number; pageCount: number;}>> {
    //     return await this.service.getUserConversations(req.user.id, dto);
    // }

    @Roles(Role.ADMIN, Role.VENDOR)
    @Get('conversations')
    async getUserConversations(
        @Req() req: AuthenticatedRequest
    ): Promise<ApiResponse<EnrichedConversation[]>> {
        return await this.service.getUserConversations(req.user.id);
    }

    @Roles(Role.ADMIN, Role.VENDOR)
    @Get('thread')
    async getMessageThread(
        @Query() dto: GetMessagesDto
    ): Promise<ApiResponse<Message[]>> {
        return await this.service.getMessages(dto);
    }
}
