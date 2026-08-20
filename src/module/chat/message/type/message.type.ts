import { Role } from 'src/enums/role.enum';

export interface MessageInterface {
    id: string;
    conversationId: string;
    senderId: string;
    senderRole: Role.CUSTOMER | Role.ADMIN;
    content: string;
    isRead: boolean;
    createdAt: Date;
    updatedAt: Date;
    isDeleted: boolean;
}
