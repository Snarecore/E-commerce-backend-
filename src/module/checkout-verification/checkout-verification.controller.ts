import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthSessionService } from '../auth/session/auth-session.service';
import { SessionUser } from '../auth/session/auth-token.types';
import { setSessionCookies } from '../../utils/cookie-config';
import { Public } from '../../decorators/public.decorator';
import { ApiResponse, ResponseUtils } from '../../utils/response.utils';
import { VerificationChallengeService } from './services/verification-challenge.service';
import { VerificationOrchestratorService } from './services/verification-orchestrator.service';
import { GuestAccountClaimService } from './services/guest-account-claim.service';
import { ConfirmVerificationDto } from './interfaces/verification-provider.interface';
import { CONFIG } from '../../utils/config';

@Controller({ path: 'checkout-verification', version: CONFIG.API_VERSION })
export class CheckoutVerificationController {
    constructor(
        private readonly challengeService: VerificationChallengeService,
        private readonly orchestratorService: VerificationOrchestratorService,
        private readonly claimService: GuestAccountClaimService,
        private readonly authSessionService: AuthSessionService
    ) {}

    @Public()
    @Get('config')
    async getConfig(): Promise<ApiResponse<any>> {
        const result = this.challengeService.getVerificationConfig();
        return ResponseUtils.successResponseHandler(200, 'Verification configuration retrieved.', 'data', result);
    }

    @Public()
    @Post('start')
    async start(
        @Body() body: { phone: string },
        @Req() req: Request
    ): Promise<ApiResponse<any>> {
        const clientIp = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '');
        const result = await this.challengeService.initiateChallenge(body.phone, clientIp);
        return ResponseUtils.successResponseHandler(200, 'Verification challenge initiated.', 'data', result);
    }

    @Public()
    @Post('confirm')
    async confirm(
        @Body() dto: ConfirmVerificationDto,
        @Req() req: Request
    ): Promise<ApiResponse<any>> {
        const clientIp = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '');
        dto.clientIp = clientIp;
        const result = await this.orchestratorService.confirmVerification(dto);
        return ResponseUtils.successResponseHandler(200, 'Phone number successfully verified.', 'data', result);
    }

    @Public()
    @Post('claim-account')
    async claimAccount(
        @Body() body: { claimToken: string; password: string; name?: string },
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<ApiResponse<any>> {
        const result = await this.claimService.claimAccount(body.claimToken, body.password, body.name);

        // Sign the new customer in with the same httpOnly session as a normal login
        const user = result.user as SessionUser;
        const tokens = await this.authSessionService.createSession(
            { id: user.id, email: user.email, role: user.role, name: user.name },
            { ipAddress: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null }
        );
        setSessionCookies(res, user.role, tokens);

        return ResponseUtils.successResponseHandler(200, result.message, 'data', { user: result.user });
    }
}
