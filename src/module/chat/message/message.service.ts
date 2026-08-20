import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ResponseUtils, ApiResponse } from 'src/utils/response.utils';
import { MessageRepository } from './message.repository';
import { ConversationRepository } from '../conversation/conversation.repository';
import { Role } from 'src/enums/role.enum';
import { Message } from './entities/message.entity';
import { UserRepository } from 'src/module/user/user.repository';
import { EnrichedConversation } from '../conversation/type/conversation.type';
import { toSafeUser } from 'src/utils/safe-user.utils';
import { CustomerSendMessageDto } from './dto/customer-send-message.dto';
import { AdminReplyDto } from './dto/admin-reply.dto';
import { GetConversationsDto } from './dto/get-conversations.dto';
import { GetThreadDto } from './dto/get-thread.dto';
import { Conversation } from '../conversation/entities/conversation.entity';

@Injectable()
export class MessageService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly messageRepository: MessageRepository,
        private readonly conversationRepository: ConversationRepository,
        private readonly userRepository: UserRepository
    ) { }

    /**
     * Customer sends a message from the frontend floating chat button.
     * Wrapped in a lightweight ACID transaction (InnoDB) for atomicity across message creation,
     * atomic unread increment, and inbox snippet updates.
     */
    async sendCustomerMessage(customerId: string, dto: CustomerSendMessageDto): Promise<ApiResponse<Message>> {
        try {
            const savedMessage = await this.dataSource.transaction(async (manager) => {
                const conversationRepo = manager.getRepository(Conversation);
                const messageRepo = manager.getRepository(Message);

                let conversation = await conversationRepo.findOne({
                    where: { customerId, isDeleted: false }
                });

                if (!conversation) {
                    const newConvo = conversationRepo.create({
                        customerId,
                        unreadCountAdmin: 0,
                        lastMessage: dto.content,
                        lastMessageAt: new Date()
                    });
                    conversation = await conversationRepo.save(newConvo);
                }

                const message = messageRepo.create({
                    conversationId: conversation.id,
                    senderId: customerId,
                    senderRole: Role.CUSTOMER,
                    content: dto.content,
                    isRead: false
                });
                const saved = await messageRepo.save(message);

                // Atomic DB increment to prevent race conditions during high traffic
                await conversationRepo.increment({ id: conversation.id }, 'unreadCountAdmin', 1);

                // Update inbox snippet and timestamp
                await conversationRepo.update(conversation.id, {
                    lastMessage: dto.content,
                    lastMessageAt: new Date()
                });

                return saved;
            });

            return ResponseUtils.successResponseHandler(201, 'Message sent successfully.', 'data', savedMessage);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Admin replies to a customer's conversation from the admin dashboard.
     * Wrapped in an ACID transaction.
     */
    async replyByAdmin(adminId: string, dto: AdminReplyDto): Promise<ApiResponse<Message>> {
        try {
            const savedMessage = await this.dataSource.transaction(async (manager) => {
                const conversationRepo = manager.getRepository(Conversation);
                const messageRepo = manager.getRepository(Message);

                const conversation = await conversationRepo.findOne({
                    where: { id: dto.conversationId, isDeleted: false }
                });
                if (!conversation) {
                    throw new HttpException('Conversation not found.', HttpStatus.NOT_FOUND);
                }

                const message = messageRepo.create({
                    conversationId: dto.conversationId,
                    senderId: adminId,
                    senderRole: Role.ADMIN,
                    content: dto.content,
                    isRead: false
                });
                const saved = await messageRepo.save(message);

                // Update lastMessage and lastMessageAt (admin replies do not increase unreadCountAdmin)
                await conversationRepo.update(dto.conversationId, {
                    lastMessage: dto.content,
                    lastMessageAt: new Date()
                });

                return saved;
            });

            return ResponseUtils.successResponseHandler(201, 'Reply sent successfully.', 'data', savedMessage);
        } catch (error: unknown) {
            if (error instanceof HttpException) throw error;
            const message = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Admin inbox list — all conversations sorted by lastMessageAt DESC with pagination and customer safe user info.
     */
    async getAdminConversations(dto: GetConversationsDto): Promise<ApiResponse<{
        data: EnrichedConversation[];
        total: number;
        page: number;
        limit: number;
        pageCount: number;
    }>> {
        try {
            const page = dto.page || 1;
            const limit = dto.limit || 20;

            const result = await this.conversationRepository.findAllConversationsPaginated(page, limit);

            const customerIds = [...new Set(result.data.map(convo => convo.customerId))];
            const users = customerIds.length > 0 ? await this.userRepository.findByIds(customerIds) : [];
            const userMap = new Map(users.map(user => [user.id, toSafeUser(user)]));

            const enrichedData: EnrichedConversation[] = result.data.map(convo => ({
                ...convo,
                customer: userMap.get(convo.customerId) || null
            }));

            return ResponseUtils.successResponseHandler(200, 'Conversations fetched successfully.', 'data', {
                data: enrichedData,
                total: result.total,
                page: result.page,
                limit: result.limit,
                pageCount: result.pageCount
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Customer fetches their own conversation and the latest 50 messages.
     */
    async getMyConversation(customerId: string): Promise<ApiResponse<{
        conversation: Conversation | null;
        messages: Message[];
    }>> {
        try {
            const conversation = await this.conversationRepository.findByCustomerId(customerId);
            if (!conversation) {
                return ResponseUtils.successResponseHandler(200, 'No active conversation found.', 'data', {
                    conversation: null,
                    messages: []
                });
            }

            // Fetch latest 50 messages in chronological order
            const messages = await this.messageRepository.getThreadMessages(conversation.id, undefined, 50);

            return ResponseUtils.successResponseHandler(200, 'My conversation fetched successfully.', 'data', {
                conversation,
                messages
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Fetch thread messages with deterministic cursor-based pagination (for infinite scroll up / load more).
     * Authorizes customer to only access their own conversation.
     * Resets unreadCountAdmin to 0 if an admin opens the thread.
     */
    async getThreadMessages(
        user: { id: string; role: Role },
        dto: GetThreadDto
    ): Promise<ApiResponse<Message[]>> {
        try {
            const conversation = await this.conversationRepository.findOne(dto.conversationId);
            if (!conversation) {
                throw new HttpException('Conversation not found.', HttpStatus.NOT_FOUND);
            }

            // Authorization check
            if (user.role !== Role.ADMIN && conversation.customerId !== user.id) {
                throw new HttpException('Access denied to this conversation thread.', HttpStatus.FORBIDDEN);
            }

            // Admin viewing thread resets unreadCountAdmin
            if (user.role === Role.ADMIN && conversation.unreadCountAdmin > 0) {
                await this.conversationRepository.update(conversation.id, { unreadCountAdmin: 0 });
            }

            const limit = dto.limit || 50;
            const messages = await this.messageRepository.getThreadMessages(dto.conversationId, dto.cursor, limit);

            return ResponseUtils.successResponseHandler(200, 'Messages fetched successfully.', 'data', messages);
        } catch (error: unknown) {
            if (error instanceof HttpException) throw error;
            const message = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
