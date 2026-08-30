import { Controller } from '@nestjs/common';
import { CONFIG } from '../../utils/config';
import { UserProfileService } from './user-profile.service';

@Controller({ path: 'user-profile', version: CONFIG.API_VERSION })
export class UserProfileController {
    constructor(private readonly service: UserProfileService) { }
}
