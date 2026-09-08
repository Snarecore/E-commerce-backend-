export interface MessageCreatedPayload {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'customer' | 'admin';
  content: string;
  createdAt: string;
}

export interface ConversationUpdatedPayload {
  conversationId: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCountAdmin: number;
}

export interface OrderCreatedPayload {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  createdAt: string;
}

export interface OrderStatusUpdatedPayload {
  orderId: string;
  status: string;
  changedAt: string;
  note?: string;
}

export interface StockUpdatedPayload {
  productId: string;
  sizeStock: Record<string, number> | null;
  totalQuantity: number;
}

export interface AdminNotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface TypingEventPayload {
  conversationId: string;
  userId: string;
  userRole: 'customer' | 'admin';
  userName?: string;
}

export interface MessageSeenPayload {
  conversationId: string;
  seenAt: string;
  seenBy: string;
}
