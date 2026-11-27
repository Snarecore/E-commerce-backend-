import { IsString, Matches, MaxLength } from 'class-validator';

/** Ids become part of a room name, so only allow characters a UUID or slug can contain. */
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const ROOM_ID_MESSAGE = 'must contain only letters, digits, "-" or "_"';

export class ConversationRoomDto {
    @IsString()
    @MaxLength(64)
    @Matches(ROOM_ID_PATTERN, { message: `conversationId ${ROOM_ID_MESSAGE}` })
    conversationId!: string;
}

export class ProductRoomDto {
    @IsString()
    @MaxLength(64)
    @Matches(ROOM_ID_PATTERN, { message: `productId ${ROOM_ID_MESSAGE}` })
    productId!: string;
}
