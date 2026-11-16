import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../database/abstract.entity';

/**
 * One row per refresh-token login session. The refresh JWT carries the row id as `jti`,
 * and only a SHA-256 hash of the token is stored, so a DB leak does not leak sessions.
 * Rotation revokes the row and points `replacedById` at its successor.
 */
@Entity('auth_sessions')
@Index('IDX_auth_sessions_userId', ['userId'])
export class AuthSession extends AbstractEntity {
	@Column({ type: 'varchar', length: 36 })
	userId: string;

	@Column({ type: 'char', length: 64 })
	tokenHash: string;

	@Column({ type: 'timestamp' })
	expiresAt: Date;

	@Column({ type: 'timestamp', nullable: true })
	revokedAt: Date | null;

	@Column({ type: 'varchar', length: 32, nullable: true })
	revokedReason: string | null;

	@Column({ type: 'varchar', length: 36, nullable: true })
	replacedById: string | null;

	@Column({ type: 'varchar', length: 64, nullable: true })
	ipAddress: string | null;

	@Column({ type: 'varchar', length: 512, nullable: true })
	userAgent: string | null;
}
