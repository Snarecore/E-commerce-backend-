import { Role } from "src/enums/role.enum";

export interface MessageInterface {
    id: string;
    senderId: string;
    senderRole: Role;
    receiverId: string;
    receiverRole: Role;
    content: string;
    isRead: boolean;
    conversationId: string;
    createdAt: Date;
    updatedAt: Date;
    isDeleted: boolean;
}
