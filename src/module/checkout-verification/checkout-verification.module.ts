import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CheckoutPhoneVerification } from './entities/checkout-phone-verification.entity';
import { GuestAccountClaim } from './entities/guest-account-claim.entity';
import { FirebasePhoneProvider } from './providers/firebase-phone.provider';
import { MockPhoneProvider } from './providers/mock-phone.provider';
import { VerificationChallengeService } from './services/verification-challenge.service';
import { VerificationOrchestratorService } from './services/verification-orchestrator.service';
import { VerificationConsumptionService } from './services/verification-consumption.service';
import { GuestAccountClaimService } from './services/guest-account-claim.service';
import { CheckoutVerificationController } from './checkout-verification.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([CheckoutPhoneVerification, GuestAccountClaim]),
        AuthModule
    ],
    controllers: [CheckoutVerificationController],
    providers: [
        FirebasePhoneProvider,
        MockPhoneProvider,
        VerificationChallengeService,
        VerificationOrchestratorService,
        VerificationConsumptionService,
        GuestAccountClaimService
    ],
    exports: [
        VerificationConsumptionService,
        GuestAccountClaimService,
        VerificationOrchestratorService,
        VerificationChallengeService
    ]
})
export class CheckoutVerificationModule {}
