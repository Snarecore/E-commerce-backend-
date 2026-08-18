import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SesEmailService } from './ses-email.service';

@Module({
    imports: [ConfigModule],
    providers: [SesEmailService],
    exports: [SesEmailService]
})
export class SesModule { }