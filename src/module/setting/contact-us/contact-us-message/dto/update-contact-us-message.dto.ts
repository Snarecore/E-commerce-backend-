import { PartialType } from '@nestjs/mapped-types';
import { CreateContactUsMessageDto } from './create-contact-us-message.dto';

export class UpdateContactUsMessageDto extends PartialType(CreateContactUsMessageDto) {}
