import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UploadMulterFile } from 'src/module/space-module/space-service';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { ResponseUtils, ApiResponse } from 'src/utils/response.utils';
import { MessageRepository } from './message.repository';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageInterface } from './type/message.type';
import { ConversationRepository } from '../conversation/conversation.repository';
import { Role } from 'src/enums/role.enum';
import { Conversation } from '../conversation/entities/conversation.entity';
import { Message } from './entities/message.entity';
import { GetMessagesDto } from './dto/get-messages.dto';
import { ConversationFilterDto } from '../conversation/dto/conversation-filter.dto';
import { UserRepository } from 'src/module/user/user.repository';
import { EnrichedConversation } from '../conversation/type/conversation.type';
import { toSafeUser } from 'src/utils/safe-user.utils';

@Injectable()
export class MessageService {
    constructor(
        private readonly messageRepository: MessageRepository,
        private readonly conversationRepository: ConversationRepository,
        private readonly userRepository: UserRepository
    ) { }

    private async findOrCreateConversation(
        senderId: string,
        senderRole: Role,
        receiverId: string,
        receiverRole: Role
    ): Promise<Conversation> {
        if (senderId === receiverId && senderRole === receiverRole) {
            throw new HttpException('Cannot message yourself.', HttpStatus.BAD_REQUEST);
        }

        const existing = await this.conversationRepository.findOneByQuery({
            participantOneId: senderId,
            participantTwoId: receiverId,
            participantOneRole: senderRole,
            participantTwoRole: receiverRole
        }) ?? await this.conversationRepository.findOneByQuery({
            participantOneId: receiverId,
            participantTwoId: senderId,
            participantOneRole: receiverRole,
            participantTwoRole: senderRole
        });

        if (existing) return existing;

        return await this.conversationRepository.create({
            participantOneId: senderId,
            participantTwoId: receiverId,
            participantOneRole: senderRole,
            participantTwoRole: receiverRole
        });
    }

    async sendMessage(dto: SendMessageDto): Promise<ApiResponse<Message>> {
        try {
            const conversation = await this.findOrCreateConversation(
                dto.senderId,
                dto.senderRole,
                dto.receiverId,
                dto.receiverRole
            );

            const message = await this.messageRepository.create({
                ...dto,
                conversationId: conversation.id,
                isRead: false
            });

            return ResponseUtils.successResponseHandler(201, 'Message sent successfully.', 'data', message);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // async getUserConversations(userId: string, dto: ConversationFilterDto): Promise<ApiResponse<{ data: EnrichedConversation[]; total: number; page: number; limit: number; pageCount: number; }>> {
    //     try {
    //         const page = dto.page || 1;
    //         const limit = dto.limit || 10;

    //         const result = await this.conversationRepository.paginateUserConversations(userId, page, limit);

    //         const userIds = new Set<string>();
    //         result.data.forEach(convo => {
    //             userIds.add(convo.participantOneId);
    //             userIds.add(convo.participantTwoId);
    //         });

    //         const users = await this.userRepository.findByIds([...userIds]);
    //         const userMap = new Map(users.map(user => [user.id, user]));

    //         const enrichedData = result.data.map(key => ({
    //             ...key,
    //             participantOne: toSafeUser(userMap.get(key.participantOneId)!),
    //             participantTwo: toSafeUser(userMap.get(key.participantTwoId)!)
    //         }));

    //         return ResponseUtils.successResponseHandler(200, 'Conversations data fetched successfully.', 'data', {
    //             data: enrichedData as EnrichedConversation[],
    //             total: result.total,
    //             page: result.page,
    //             limit: result.limit,
    //             pageCount: result.pageCount
    //         });
    //     } catch (error: unknown) {
    //         const message = error instanceof Error ? error.message : 'Internal Server Error';
    //         throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    //     }
    // }

    async getUserConversations(userId: string): Promise<ApiResponse<EnrichedConversation[]>> {
        try {
            const data = await this.conversationRepository.findAllUserConversations(userId);

            const userIds = new Set<string>();
            data.forEach(key => {
                userIds.add(key.participantOneId);
                userIds.add(key.participantTwoId);
            });

            const users = await this.userRepository.findByIds([...userIds]);
            const userMap = new Map(users.map(user => [user.id, toSafeUser(user)]));

            const enrichedData: EnrichedConversation[] = data.map(key => ({
                ...key,
                participantOne: userMap.get(key.participantOneId),
                participantTwo: userMap.get(key.participantTwoId)
            }));

            return ResponseUtils.successResponseHandler(200, 'Conversations data fetched successfully.', 'data', enrichedData as EnrichedConversation[]);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getMessages(dto: GetMessagesDto): Promise<ApiResponse<Message[]>> {
        try {
            const messages = await this.messageRepository.findAllWithOrder(
                { conversationId: dto.conversationId },
                { createdAt: 'ASC' }
            );

            return ResponseUtils.successResponseHandler(200, 'Messages fetched successfully.', 'data', messages);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
