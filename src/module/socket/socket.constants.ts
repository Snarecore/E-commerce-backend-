/** Events the server pushes to clients. */
export enum SocketEvent {
    MESSAGE_CREATED = 'message_created',
    MESSAGE_SEEN = 'message_seen',
    CONVERSATION_UPDATED = 'conversation_updated',
    ORDER_CREATED = 'order_created',
    ORDER_STATUS_UPDATED = 'order_status_updated',
    STOCK_UPDATED = 'stock_updated',
    ADMIN_NOTIFICATION = 'admin_notification',
    TYPING_STARTED = 'typing_started',
    TYPING_STOPPED = 'typing_stopped',
}

/** Commands clients send to the server. Every value here must have a handler in SocketGateway. */
export enum SocketCommand {
    TYPING_START = 'typing_start',
    TYPING_STOP = 'typing_stop',
    JOIN_CONVERSATION = 'join_conversation',
    LEAVE_CONVERSATION = 'leave_conversation',
    JOIN_PRODUCT = 'join_product',
    LEAVE_PRODUCT = 'leave_product',
}

export enum SocketRoom {
    ADMIN_ROOM = 'admin_room',
}

/** Single source of truth for room names. Never build a room string by hand. */
export const SOCKET_ROOMS = {
    ADMIN_ROOM: SocketRoom.ADMIN_ROOM,
    USER: (userId: string) => `user_${userId}`,
    PRODUCT: (productId: string) => `product_${productId}`,
    CONVERSATION: (conversationId: string) => `conv_${conversationId}`,
};

/**
 * Which identity a handshake asks for when the browser holds both the admin and the
 * customer cookie (they share a domain). Sent by the client as `auth: { scope }`.
 */
export enum SocketAuthScope {
    ADMIN = 'admin',
    CUSTOMER = 'customer',
}
