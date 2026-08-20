import { SafeUser } from 'src/utils/safe-user.utils';

export interface EnrichedConversation {
    id: string;
    customerId: string;
    lastMessage: string | null;
    lastMessageAt: Date | null;
    unreadCountAdmin: number;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    customer?: SafeUser | null;
}
