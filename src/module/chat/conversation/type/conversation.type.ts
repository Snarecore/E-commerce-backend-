import { Role } from 'src/enums/role.enum';
import { SafeUser } from 'src/utils/safe-user.utils';

export interface EnrichedConversation {
    id: string;
    participantOneId: string;
    participantOneRole: Role;
    participantTwoId: string;
    participantTwoRole: Role;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    participantOne?: SafeUser;
    participantTwo?: SafeUser;
}
