import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { UserProfile } from './entities/user-profile.entity';

@Injectable()
export class UserProfileRepository extends AbstractRepository<UserProfile> {
    constructor(dataSource: DataSource) {
        super(dataSource, UserProfile);
    }
}
