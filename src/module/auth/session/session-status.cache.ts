import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AUTH_SESSION_EVENTS, SessionRevokedEvent } from './auth-session.events';
import { AuthSessionService } from './auth-session.service';

/** How long a session lookup result is trusted before the DB is asked again. */
const SESSION_STATUS_TTL_MS = 30 * 1000;
/** Hard cap so the cache cannot grow without bound; oldest entries are evicted first. */
const MAX_ENTRIES = 10_000;

interface CacheEntry {
    active: boolean;
    expiresAt: number;
}

/**
 * Per-process cache in front of AuthSessionService.isSessionActive, used by the HTTP JWT
 * strategy so a session check does not cost a DB query on every request.
 *
 * Revocation is immediate: the cache drops a user's entries as soon as a session-revoked
 * event fires. The app runs as a single process (see ecosystem.config.js), so that event
 * always reaches this cache; the TTL only bounds staleness if it ever does not.
 */
@Injectable()
export class SessionStatusCache {
    private readonly entries = new Map<string, CacheEntry>();

    constructor(private readonly authSessionService: AuthSessionService) {}

    async isActive(sessionId: string, userId: string): Promise<boolean> {
        const key = this.key(userId, sessionId);
        const cached = this.entries.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.active;
        }

        const active = await this.authSessionService.isSessionActive(sessionId, userId);
        this.set(key, active);
        return active;
    }

    @OnEvent(AUTH_SESSION_EVENTS.REVOKED)
    handleSessionRevoked(event: SessionRevokedEvent): void {
        const prefix = this.key(event.userId, '');
        for (const key of this.entries.keys()) {
            if (key.startsWith(prefix)) this.entries.delete(key);
        }
    }

    private set(key: string, active: boolean): void {
        this.entries.delete(key);
        if (this.entries.size >= MAX_ENTRIES) {
            const oldest: IteratorResult<string> = this.entries.keys().next();
            if (!oldest.done) this.entries.delete(oldest.value);
        }
        this.entries.set(key, { active, expiresAt: Date.now() + SESSION_STATUS_TTL_MS });
    }

    private key(userId: string, sessionId: string): string {
        return `${userId}:${sessionId}`;
    }
}
