import { IsEmail, IsNotEmpty } from 'class-validator';
import { UpdateEmailSettingDto } from './update-email-setting.dto';

export class TestEmailSettingDto extends UpdateEmailSettingDto {
    @IsNotEmpty()
    @IsEmail()
    testRecipient: string;
}
