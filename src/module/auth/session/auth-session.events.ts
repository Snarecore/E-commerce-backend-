/**
 * Domain events published by the auth session layer.
 *
 * Other modules (for example the WebSocket gateway) subscribe to these instead of being
 * called directly, so the auth module never depends on transport-level modules.
 */
export const AUTH_SESSION_EVENTS = {
    REVOKED: 'auth.session.revoked',
} as const;

export class SessionRevokedEvent {
    constructor(
        public readonly userId: string,
        public readonly reason: string
    ) {}
}
