import { Module, Global } from '@nestjs/common';
import { JwtAuthModule } from './jwt/jwt-auth.module';

@Global()
@Module({
	imports: [JwtAuthModule],
	exports: [JwtAuthModule]
})
export class CoreModule {}
