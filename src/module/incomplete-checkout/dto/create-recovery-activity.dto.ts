import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RecoveryAction } from '../enums/recovery-action.enum';

export class CreateRecoveryActivityDto {
    @IsNotEmpty()
    @IsEnum(RecoveryAction)
    action: RecoveryAction;

    @IsOptional()
    @IsString()
    note?: string;
}
