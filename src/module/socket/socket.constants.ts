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

export enum SocketCommand {
    TYPING_START = 'typing_start',
    TYPING_STOP = 'typing_stop',
    MARK_SEEN = 'mark_seen',
    JOIN_CONVERSATION = 'join_conversation',
    LEAVE_CONVERSATION = 'leave_conversation',
    JOIN_PRODUCT = 'join_product',
    LEAVE_PRODUCT = 'leave_product',
}

export enum SocketRoom {
    ADMIN_ROOM = 'admin_room',
}

export const SOCKET_ROOMS = {
    ADMIN_ROOM: SocketRoom.ADMIN_ROOM,
    USER: (userId: string) => `user_${userId}`,
    PRODUCT: (productId: string) => `product_${productId}`,
    CONVERSATION: (conversationId: string) => `conv_${conversationId}`,
};
