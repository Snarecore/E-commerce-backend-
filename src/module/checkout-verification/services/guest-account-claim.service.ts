import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { GuestAccountClaim, GuestClaimStatus } from '../entities/guest-account-claim.entity';
import { User } from '../../user/entities/user.entity';
import { Orders } from '../../order/entity/order.entity';
import { Role } from '../../../enums/role.enum';
import { normalizeBDPhone } from '../../../utils/phone-normalizer.util';
import { createSha256 } from '../../../utils/crypto-hasher.util';
import { isDuplicateKeyError } from '../../../utils/db-errors.util';

@Injectable()
export class GuestAccountClaimService {
    private readonly logger = new Logger(GuestAccountClaimService.name);

    constructor(
        @InjectRepository(GuestAccountClaim)
        private readonly claimRepo: Repository<GuestAccountClaim>,
        private readonly dataSource: DataSource
    ) {}

    /**
     * Issues an opaque, single-use claim token for guest post-checkout account conversion.
     * Raw secret is returned to client, while only the SHA-256 hash is persisted.
     */
    async issueClaimToken(orderId: string, phone: string): Promise<string> {
        const canonicalPhone = normalizeBDPhone(phone);
        const rawSecret = crypto.randomBytes(32).toString('hex');
        const tokenHash = createSha256(rawSecret);

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours

        const claim = this.claimRepo.create({
            orderId,
            phone: canonicalPhone,
            tokenHash,
            status: GuestClaimStatus.ISSUED,
            expiresAt
        });

        await this.claimRepo.save(claim);
        return rawSecret;
    }

    /**
     * Securely claims a guest order and creates a registered customer account.
     * Implements phone reallocation protection: If phone already belongs to an existing user,
     * auto-linking is refused without direct credential authentication.
     */
    async claimAccount(
        claimToken: string,
        password: string,
        name?: string
    ): Promise<{ user: Partial<User>; message: string }> {
        if (!claimToken || !password) {
            throw new BadRequestException('Claim token and password are required.');
        }

        if (password.length < 6) {
            throw new BadRequestException('Password must be at least 6 characters long.');
        }

        const tokenHash = createSha256(claimToken);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Find and lock the claim record
            const claim = await queryRunner.manager.findOne(GuestAccountClaim, {
                where: { tokenHash }
            });

            if (!claim) {
                throw new BadRequestException('Invalid account claim token.');
            }

            if (claim.status === GuestClaimStatus.CONSUMED) {
                throw new ConflictException('This account claim token has already been consumed.');
            }

            if (claim.status === GuestClaimStatus.EXPIRED || claim.expiresAt.getTime() <= Date.now()) {
                throw new BadRequestException('Account claim token has expired.');
            }

            const canonicalPhone = normalizeBDPhone(claim.phone);

            // Reallocated Phone Protection: Check if phone already registered to another user
            const existingUser = await queryRunner.manager.findOne(User, {
                where: { phone: canonicalPhone }
            });

            if (existingUser) {
                throw new ConflictException(
                    'An account with this phone number already exists. Please log in with your existing password to view your orders.'
                );
            }

            // Find order to fetch customer details
            const order = await queryRunner.manager.findOne(Orders, {
                where: { orderId: claim.orderId }
            });

            const customerName = name || order?.shippingAddress?.name || 'Valued Customer';
            const shippingEmail = String(order?.shippingAddress?.email || '').trim().toLowerCase();
            const customerEmail = shippingEmail || `${canonicalPhone.replace(/\D/g, '')}@guest.bazaarbound.com`;

            // The checkout email is unverified. If it already belongs to an account (soft-deleted
            // included), claiming must not create a second account under someone else's address.
            if (shippingEmail) {
                const emailOwner = await queryRunner.manager.findOne(User, { where: { email: shippingEmail } });
                if (emailOwner) {
                    throw new ConflictException(
                        'An account with this email already exists. Please log in to view your orders.'
                    );
                }
            }
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create new User entity
            const newUser = queryRunner.manager.create(User, {
                name: customerName,
                email: customerEmail,
                phone: canonicalPhone,
                password: hashedPassword,
                role: Role.CUSTOMER
            });

            const savedUser = await queryRunner.manager.save(newUser);

            // Link the order to the new user
            if (order) {
                order.userId = savedUser.id;
                await queryRunner.manager.save(order);
            }

            // Mark claim as CONSUMED
            claim.status = GuestClaimStatus.CONSUMED;
            claim.consumedAt = new Date();
            await queryRunner.manager.save(claim);

            await queryRunner.commitTransaction();

            this.logger.log(`[ACCOUNT CLAIMED] UserID=${savedUser.id} Phone=${canonicalPhone} OrderID=${claim.orderId}`);

            return {
                user: {
                    id: savedUser.id,
                    name: savedUser.name,
                    email: savedUser.email,
                    phone: savedUser.phone,
                    role: savedUser.role
                },
                message: 'Account successfully created and linked to your order.'
            };
        } catch (err: any) {
            await queryRunner.rollbackTransaction();
            if (isDuplicateKeyError(err)) {
                throw new ConflictException('An account with this email already exists. Please log in to view your orders.');
            }
            throw err;
        } finally {
            await queryRunner.release();
        }
    }
}
