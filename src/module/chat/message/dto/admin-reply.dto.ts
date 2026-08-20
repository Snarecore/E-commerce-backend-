import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class AdminReplyDto {
    @IsNotEmpty()
    @IsString()
    conversationId: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(2000)
    content: string;
}
