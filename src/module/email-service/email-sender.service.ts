import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ResetPasswordMailDto } from './dto/create-reset-password-email.dto';

export interface OrderItemEmailData {
	name?: string;
	productName?: string;
	price?: number | string;
	quantity?: number | string;
	size?: string;
	productImage?: string;
}

export interface OrderConfirmationEmailData {
	to: string;
	orderId: string;
	customerName: string;
	totalAmount: number | string;
	subtotal?: number | string;
	deliveryCharge?: number | string;
	discountAmount?: number | string;
	paymentMethod: string;
	paymentStatus?: string;
	shippingAddress?: {
		name?: string;
		phone?: string;
		address?: string;
		city?: string;
		email?: string;
	};
	items?: OrderItemEmailData[];
	createdAt?: string;
	viewOrderUrl?: string;
}

export interface OrderStatusUpdateEmailData {
	to: string;
	orderId: string;
	customerName: string;
	status: string;
	previousStatus?: string;
	totalAmount?: number | string;
	paymentMethod?: string;
	note?: string;
	courierName?: string;
	trackingId?: string;
	courierTrackingLink?: string;
	shippingAddress?: {
		name?: string;
		phone?: string;
		address?: string;
		city?: string;
	};
	viewOrderUrl?: string;
}

@Injectable()
export class EmailService {
	private readonly logger = new Logger(EmailService.name);

	constructor(private readonly mailerService: MailerService) { }

	/**
	 * Send password reset email
	 */
	async sendResetPasswordEmail(dto: ResetPasswordMailDto): Promise<{ message: string }> {
		const { to, from, subject, username, token, companyEmail } = dto;

		try {
			await this.mailerService.sendMail({
				to: to,
				bcc: ['sabbir.qligence@gmail.com'],
				from: from,
				subject: subject,
				template: 'forgot_password_email',
				context: {
					username: username,
					token: token,
					email: to,
					passwordResetURL: process.env.PASSWORD_RESET_PAGE,
					companyEmail: companyEmail
				}
			});
			return { message: `Mail sent to: ${Array.isArray(to) ? to[0] : to}` };
		} catch (error: any) {
			this.logger.error(`[EmailService] Failed to send reset password email: ${error?.message}`);
			return { message: `Failed to send email: ${error?.message}` };
		}
	}

	/**
	 * Send order confirmation email upon successful order placement
	 */
	async sendOrderConfirmationEmail(data: OrderConfirmationEmailData): Promise<{ success: boolean; message: string }> {
		if (!data.to || !data.to.includes('@')) {
			this.logger.warn(`[EmailService] Skipping order confirmation email: invalid recipient "${data.to}"`);
			return { success: false, message: 'Invalid recipient email' };
		}

		const frontendUrl = process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000';
		const supportEmail = process.env.EMAIL_SENDER_MAIL || 'support@fashiontime.com';
		const formattedItems = (data.items || []).map((item) => {
			const unit = Number(item.price) || 0;
			const qty = Number(item.quantity) || 1;
			return {
				name: item.name || item.productName || 'Fashion Item',
				price: unit.toFixed(2),
				quantity: qty,
				size: item.size ? String(item.size).trim() : null,
				total: (unit * qty).toFixed(2)
			};
		});

		const shippingName = data.shippingAddress?.name || data.customerName || 'Valued Customer';
		const shippingPhone = data.shippingAddress?.phone || 'N/A';
		const shippingAddressText = [data.shippingAddress?.address, data.shippingAddress?.city].filter(Boolean).join(', ') || 'N/A';

		const context = {
			customerName: data.customerName || 'Valued Customer',
			orderId: data.orderId,
			orderDate: data.createdAt || new Date().toLocaleDateString('en-US', { dateStyle: 'medium' }),
			paymentMethod: (data.paymentMethod || 'COD').toUpperCase(),
			paymentStatus: (data.paymentStatus || 'Pending').toUpperCase(),
			subtotal: Number(data.subtotal || 0).toFixed(2),
			deliveryCharge: Number(data.deliveryCharge || 0).toFixed(2),
			discountAmount: data.discountAmount && Number(data.discountAmount) > 0 ? Number(data.discountAmount).toFixed(2) : null,
			totalAmount: Number(data.totalAmount || 0).toFixed(2),
			items: formattedItems,
			shippingName,
			shippingPhone,
			shippingAddressText,
			viewOrderUrl: data.viewOrderUrl || `${frontendUrl}/order-confirmation/${data.orderId}`,
			supportEmail,
			currentYear: new Date().getFullYear()
		};

		try {
			await this.mailerService.sendMail({
				to: data.to.trim(),
				subject: `Order Confirmed: #${data.orderId} - Fashion Time`,
				template: 'order_confirmation_email',
				context
			});
			this.logger.log(`[EmailService] Order confirmation email sent to ${data.to} for Order #${data.orderId}`);
			return { success: true, message: `Order confirmation sent to ${data.to}` };
		} catch (error: any) {
			this.logger.error(`[EmailService] Failed to send order confirmation email to ${data.to} for #${data.orderId}: ${error?.message}`);
			return { success: false, message: error?.message || 'Failed to send email' };
		}
	}

	/**
	 * Send order status update email whenever status is changed (Processing, Shipped, Delivered, etc.)
	 */
	async sendOrderStatusUpdateEmail(data: OrderStatusUpdateEmailData): Promise<{ success: boolean; message: string }> {
		if (!data.to || !data.to.includes('@')) {
			this.logger.warn(`[EmailService] Skipping status update email: invalid recipient "${data.to}"`);
			return { success: false, message: 'Invalid recipient email' };
		}

		const frontendUrl = process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000';
		const supportEmail = process.env.EMAIL_SENDER_MAIL || 'support@fashiontime.com';

		// Dynamic color scheme & headlines per status
		const statusConfigMap: Record<string, { bg: string; text: string; border: string; headline: string }> = {
			'Pending': {
				bg: '#fef3c7',
				text: '#92400e',
				border: '#fcd34d',
				headline: 'Your order is currently awaiting confirmation/approval.'
			},
			'Order Placed': {
				bg: '#e0f2fe',
				text: '#0369a1',
				border: '#bae6fd',
				headline: 'Your order has been officially verified and placed into queue.'
			},
			'Processing': {
				bg: '#fef9c3',
				text: '#854d0e',
				border: '#fde047',
				headline: 'Your order is being reviewed and processed by our inventory team.'
			},
			'Packaging': {
				bg: '#fef3c7',
				text: '#b45309',
				border: '#fde68a',
				headline: 'Your items are being carefully quality-checked and packaged.'
			},
			'Shipped': {
				bg: '#e0e7ff',
				text: '#3730a3',
				border: '#c7d2fe',
				headline: 'Your package is on its way! Track its delivery journey below.'
			},
			'Delivered': {
				bg: '#dcfce7',
				text: '#15803d',
				border: '#86efac',
				headline: 'Your package has been successfully delivered! Enjoy your purchase.'
			},
			'Completed': {
				bg: '#dcfce7',
				text: '#166534',
				border: '#86efac',
				headline: 'Order fulfilled and completed. Thank you for choosing Fashion Time.'
			},
			'Cancelled': {
				bg: '#fee2e2',
				text: '#991b1b',
				border: '#fecaca',
				headline: 'This order has been cancelled.'
			},
			'Rejected': {
				bg: '#fee2e2',
				text: '#991b1b',
				border: '#fecaca',
				headline: 'This order could not be approved and has been rejected.'
			},
			'Failed': {
				bg: '#fee2e2',
				text: '#991b1b',
				border: '#fecaca',
				headline: 'Payment or order processing failed.'
			}
		};

		const normalizedStatus = data.status || 'Updated';
		const styling = statusConfigMap[normalizedStatus] || {
			bg: '#f1f5f9',
			text: '#334155',
			border: '#cbd5e1',
			headline: `Your order status has been updated to "${normalizedStatus}".`
		};

		const hasCourierInfo = Boolean(data.courierName || data.trackingId || data.courierTrackingLink);
		const shippingName = data.shippingAddress?.name || data.customerName || '';
		const shippingAddressText = data.shippingAddress
			? [data.shippingAddress.address, data.shippingAddress.city].filter(Boolean).join(', ')
			: '';

		const context = {
			customerName: data.customerName || 'Valued Customer',
			orderId: data.orderId,
			statusLabel: normalizedStatus,
			statusHeadline: styling.headline,
			statusBgColor: styling.bg,
			statusTextColor: styling.text,
			statusBorderColor: styling.border,
			updateDate: new Date().toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			}),
			totalAmount: Number(data.totalAmount || 0).toFixed(2),
			paymentMethod: (data.paymentMethod || 'COD').toUpperCase(),
			statusNote: data.note || null,
			hasCourierInfo,
			courierName: data.courierName || null,
			trackingId: data.trackingId || null,
			courierTrackingLink: data.courierTrackingLink || null,
			shippingName,
			shippingAddressText: shippingAddressText || null,
			viewOrderUrl: data.viewOrderUrl || `${frontendUrl}/customer-dashboard?tab=order`,
			supportEmail,
			currentYear: new Date().getFullYear()
		};

		try {
			await this.mailerService.sendMail({
				to: data.to.trim(),
				subject: `Order Update: #${data.orderId} is now ${normalizedStatus} - Fashion Time`,
				template: 'order_status_update_email',
				context
			});
			this.logger.log(`[EmailService] Order status update email (${normalizedStatus}) sent to ${data.to} for Order #${data.orderId}`);
			return { success: true, message: `Status update email sent to ${data.to}` };
		} catch (error: any) {
			this.logger.error(`[EmailService] Failed to send status update email to ${data.to} for #${data.orderId}: ${error?.message}`);
			return { success: false, message: error?.message || 'Failed to send email' };
		}
	}
}
