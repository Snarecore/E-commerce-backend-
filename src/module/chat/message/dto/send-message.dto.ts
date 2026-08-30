import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '../../../../enums/role.enum';

export class SendMessageDto {
    @IsNotEmpty()
    senderId: string;

    @IsEnum(Role)
    senderRole: Role;

    @IsNotEmpty()
    receiverId: string;

    @IsEnum(Role)
    receiverRole: Role;

    @IsNotEmpty()
    content: string;
}
