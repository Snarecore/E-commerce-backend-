import { IsNotEmpty, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetThreadDto {
    @IsNotEmpty()
    @IsString()
    conversationId: string;

    /**
     * Cursor: ID of the oldest message currently visible.
     * When provided, returns 50 messages older than this cursor.
     * Omit for initial load (returns last 50 messages).
     */
    @IsOptional()
    @IsString()
    cursor?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}
