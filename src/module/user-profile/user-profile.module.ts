import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProfile } from './entities/user-profile.entity';
import { UserProfileController } from './user-profile.controller';
import { UserProfileService } from './user-profile.service';
import { UserProfileRepository } from './user-profile.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([UserProfile])
    ],
    controllers: [UserProfileController],
    providers: [UserProfileService, UserProfileRepository],
    exports: [UserProfileService, UserProfileRepository]
})
export class UserProfileModule { }
