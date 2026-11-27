import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length, Matches, MaxLength } from 'class-validator';
import { NormalizedEmail } from '../../../../../decorators/auth-fields.decorator';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Public contact form. Bounded and typed so it cannot be used to store huge or malformed payloads. */
export class CreateContactUsMessageDto {
    @Transform(trimmed)
    @IsString()
    @Length(1, 100)
    name: string;

    @NormalizedEmail()
    email: string;

    @Transform(trimmed)
    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    @Matches(/^\+?[0-9\s-]{6,20}$/, { message: 'Please enter a valid phone number.' })
    phone: string;

    @Transform(trimmed)
    @IsString()
    @Length(1, 5000)
    message: string;
}
