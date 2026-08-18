import { IsNotEmpty } from 'class-validator';

export class GetMessagesDto {
    @IsNotEmpty()
    conversationId: string;
}
