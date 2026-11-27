import { getClientIp } from '../../../utils/request-ip.util';
import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
    Logger
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditLogService } from '../audit-log.service';
import { AuditAction } from '../constants/audit-action.enum';
import { AuditModule } from '../constants/audit-module.enum';
import { AuditTargetType } from '../constants/audit-target-type.enum';
import { AuditSanitizer } from '../audit-log.sanitizer';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
    private readonly logger = new Logger(AuditLogInterceptor.name);

    constructor(private readonly auditLogService: AuditLogService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const httpCtx = context.switchToHttp();
        const req = httpCtx.getRequest<any>();
        const res = httpCtx.getResponse<any>();

        const method = (req.method || '').toUpperCase();

        // 1. Only intercept mutating actions (POST, PUT, PATCH, DELETE)
        if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            return next.handle();
        }

        const url = (req.originalUrl || req.url || '').split('?')[0];

        // 2. Ignore non-business routes, health checks, socket auth, and audit log queries
        if (
            url.includes('/audit-logs') ||
            url.includes('/auth/socket-token') ||
            url.includes('/auth/refresh-token') ||
            url.includes('/auth/me') ||
            url.includes('/auth/customer/me') ||
            url.includes('/auth/admin/me')
        ) {
            return next.handle();
        }

        const startTime = Date.now();

        return next.handle().pipe(
            tap((responsePayload) => {
                this.recordLog(req, res, method, url, startTime, 'SUCCESS', responsePayload);
            }),
            catchError((err) => {
                this.recordLog(req, res, method, url, startTime, 'FAILED', null, err);
                throw err;
            })
        );
    }

    private recordLog(
        req: any,
        res: any,
        method: string,
        url: string,
        startTime: number,
        status: 'SUCCESS' | 'FAILED',
        responsePayload?: any,
        error?: any
    ) {
        try {
            // Check actor credentials: Only track admin actions
            const user = req.user;
            const role = (user?.role || '').toString().toLowerCase();
            const isAdmin = role === 'admin' || role === 'superadmin';

            // If not logged in as admin (e.g. public guest checkout or customer browsing), skip
            if (!isAdmin) {
                return;
            }

            // Deduplication guard: If a service already registered an authoritative audit log for this request
            if (req._authoritativeAuditLogged) {
                return;
            }

            const durationMs = Date.now() - startTime;
            const statusCode = error ? (error.status || error.statusCode || 500) : (res.statusCode || 200);

            const ipAddress = getClientIp(req) ?? 'unknown';

            const userAgent = String(req.headers['user-agent'] || 'Unknown Client');

            const body = req.body || {};
            const params = req.params || {};

            const { module, action, targetType, summary, targetId } = this.resolveAuditMeta(
                url,
                method,
                body,
                params,
                responsePayload
            );

            const sanitizedBody = AuditSanitizer.sanitize(body);

            this.auditLogService.createAsyncLog({
                actorId: user.id || user.userId || null,
                actorName: user.name || user.fullName || user.email?.split('@')[0] || 'Admin',
                actorEmail: user.email || 'admin@store.com',
                actorRole: user.role || 'admin',
                action,
                module,
                targetId: String(targetId || '').trim() || null,
                targetType,
                httpMethod: method,
                route: url,
                statusCode,
                durationMs,
                ipAddress,
                userAgent,
                status,
                changes: {
                    type: 'MUTATION',
                    summary: error ? `Failed: ${error.message || 'Operation failed'}` : summary,
                    description: summary,
                    payload: sanitizedBody && Object.keys(sanitizedBody).length > 0 ? sanitizedBody : null,
                    params: params && Object.keys(params).length > 0 ? params : null,
                    error: error ? error.message : null
                }
            });
        } catch (e: any) {
            this.logger.warn(`Non-fatal audit interceptor logging error: ${e?.message}`);
        }
    }

    private resolveAuditMeta(
        url: string,
        method: string,
        body: any,
        params: any,
        responsePayload: any
    ): {
        module: AuditModule;
        action: AuditAction;
        targetType: AuditTargetType;
        summary: string;
        targetId: string | null;
    } {
        const cleanUrl = url.toLowerCase();
        let targetId = params?.id || responsePayload?.data?.id || responsePayload?.id || body?.id || null;

        // 1. Order Module
        if (cleanUrl.includes('/orders')) {
            if (cleanUrl.includes('/status')) {
                const statusName = body?.newStatus || body?.status || 'Updated';
                const oid = params?.id || body?.orderId || '';
                return {
                    module: AuditModule.ORDER,
                    action: AuditAction.ORDER_STATUS_UPDATED,
                    targetType: AuditTargetType.ORDER,
                    summary: `Updated order #${oid || targetId || 'N/A'} status to "${statusName}"`,
                    targetId: oid || targetId
                };
            }
            if (cleanUrl.includes('/courier')) {
                const courier = body?.courierName || 'Courier';
                const tracking = body?.trackingId ? ` (Tracking: ${body.trackingId})` : '';
                return {
                    module: AuditModule.ORDER,
                    action: AuditAction.ORDER_COURIER_UPDATED,
                    targetType: AuditTargetType.ORDER,
                    summary: `Assigned courier "${courier}" to order #${params?.id || targetId || ''}${tracking}`,
                    targetId: params?.id || targetId
                };
            }
            return {
                module: AuditModule.ORDER,
                action: AuditAction.ORDER_STATUS_UPDATED,
                targetType: AuditTargetType.ORDER,
                summary: `Updated order record #${params?.id || targetId || ''}`,
                targetId: params?.id || targetId
            };
        }

        // 2. Product Module
        if (cleanUrl.includes('/product') && !cleanUrl.includes('/product-review') && !cleanUrl.includes('/product-seo')) {
            const productName = body?.name || body?.title || '';
            if (method === 'POST') {
                return {
                    module: AuditModule.PRODUCT,
                    action: AuditAction.PRODUCT_CREATED,
                    targetType: AuditTargetType.PRODUCT,
                    summary: `Created new product: "${productName || 'Product'}"`,
                    targetId
                };
            }
            if (method === 'DELETE') {
                return {
                    module: AuditModule.PRODUCT,
                    action: AuditAction.PRODUCT_DELETED,
                    targetType: AuditTargetType.PRODUCT,
                    summary: `Deleted product ID #${params?.id || targetId || ''}`,
                    targetId: params?.id || targetId
                };
            }
            return {
                module: AuditModule.PRODUCT,
                action: AuditAction.PRODUCT_UPDATED,
                targetType: AuditTargetType.PRODUCT,
                summary: `Updated product "${productName || params?.id || targetId || 'Item'}"`,
                targetId: params?.id || targetId
            };
        }

        // 3. Category Module (Main, First, Second Category)
        if (cleanUrl.includes('category')) {
            const catName = body?.name || body?.title || '';
            const catLevel = cleanUrl.includes('main') ? 'Main Category' : cleanUrl.includes('second') ? 'Sub Category' : 'Category';
            if (method === 'POST') {
                return {
                    module: AuditModule.CATEGORY,
                    action: AuditAction.CATEGORY_CREATED,
                    targetType: AuditTargetType.CATEGORY,
                    summary: `Created ${catLevel}: "${catName || 'New Category'}"`,
                    targetId
                };
            }
            if (method === 'DELETE') {
                return {
                    module: AuditModule.CATEGORY,
                    action: AuditAction.CATEGORY_DELETED,
                    targetType: AuditTargetType.CATEGORY,
                    summary: `Deleted ${catLevel} ID #${params?.id || targetId || ''}`,
                    targetId: params?.id || targetId
                };
            }
            return {
                module: AuditModule.CATEGORY,
                action: AuditAction.CATEGORY_UPDATED,
                targetType: AuditTargetType.CATEGORY,
                summary: `Updated ${catLevel} "${catName || params?.id || targetId || ''}"`,
                targetId: params?.id || targetId
            };
        }

        // 4. Coupon Module
        if (cleanUrl.includes('/coupon')) {
            const code = body?.couponCode || body?.code || '';
            const disc = body?.discountAmount ? ` (${body.discountType === 'percentage' ? body.discountAmount + '%' : '৳' + body.discountAmount})` : '';
            if (method === 'POST') {
                return {
                    module: AuditModule.COUPON,
                    action: AuditAction.COUPON_CREATED,
                    targetType: AuditTargetType.COUPON,
                    summary: `Created discount coupon "${code || 'Coupon'}"${disc}`,
                    targetId
                };
            }
            if (method === 'DELETE') {
                return {
                    module: AuditModule.COUPON,
                    action: AuditAction.COUPON_DELETED,
                    targetType: AuditTargetType.COUPON,
                    summary: `Deleted coupon ID #${params?.id || targetId || ''}`,
                    targetId: params?.id || targetId
                };
            }
            return {
                module: AuditModule.COUPON,
                action: AuditAction.COUPON_UPDATED,
                targetType: AuditTargetType.COUPON,
                summary: `Updated coupon "${code || params?.id || targetId || ''}"${disc}`,
                targetId: params?.id || targetId
            };
        }

        // 5. Mega Discount / Promotional Settings
        if (cleanUrl.includes('mega-discount')) {
            const isActive = body?.isActive !== undefined ? (body.isActive ? 'Active (ON)' : 'Disabled (OFF)') : 'Updated';
            const pct = body?.discountPercentage ? ` at ${body.discountPercentage}%` : '';
            return {
                module: AuditModule.SETTINGS,
                action: AuditAction.MEGA_DISCOUNT_UPDATED,
                targetType: AuditTargetType.SETTING,
                summary: `Toggled Mega Discount: ${isActive}${pct}`,
                targetId: 'mega-discount'
            };
        }

        // 6. Email Settings
        if (cleanUrl.includes('email-setting')) {
            const host = body?.host || body?.emailHost || 'SMTP';
            const port = body?.port || body?.emailPort || '';
            return {
                module: AuditModule.SETTINGS,
                action: AuditAction.EMAIL_SETTING_UPDATED,
                targetType: AuditTargetType.SETTING,
                summary: `Updated Email SMTP Server configuration (${host}${port ? ':' + port : ''})`,
                targetId: 'email-settings'
            };
        }

        // 7. Popups & Banners
        if (cleanUrl.includes('/popup')) {
            const isEnabled = body?.status !== undefined ? (body.status ? 'Enabled' : 'Disabled') : 'Saved';
            return {
                module: AuditModule.SETTINGS,
                action: AuditAction.POPUP_UPDATED,
                targetType: AuditTargetType.SETTING,
                summary: `Updated promotional popup configuration (${isEnabled})`,
                targetId: params?.id || targetId || 'popup'
            };
        }

        if (cleanUrl.includes('hero-slider') || cleanUrl.includes('promotion')) {
            return {
                module: AuditModule.SETTINGS,
                action: AuditAction.BANNER_UPDATED,
                targetType: AuditTargetType.SETTING,
                summary: `${method === 'POST' ? 'Added new' : method === 'DELETE' ? 'Removed' : 'Updated'} homepage slider / promotional banner`,
                targetId: params?.id || targetId
            };
        }

        // 8. Stock Adjustments & Inventory
        if (cleanUrl.includes('stock-adjustment') || cleanUrl.includes('stock_adjustment')) {
            const reason = body?.reason || body?.adjustmentType || 'Inventory Reconciliation';
            return {
                module: AuditModule.INVENTORY,
                action: AuditAction.STOCK_ADJUSTED,
                targetType: AuditTargetType.INVENTORY,
                summary: `Stock adjustment executed: ${reason}`,
                targetId: params?.id || targetId
            };
        }

        // 9. Blacklist & Risk
        if (cleanUrl.includes('blacklist')) {
            const isDel = method === 'DELETE';
            return {
                module: AuditModule.RISK,
                action: AuditAction.BLACKLIST_UPDATED,
                targetType: AuditTargetType.BLACKLIST,
                summary: `${isDel ? 'Removed entry from' : 'Added entry to'} risk & fraud blacklist (${body?.phone || body?.subjectValue || params?.id || ''})`,
                targetId: params?.id || targetId
            };
        }

        // 10. CMS Pages & Policies
        if (cleanUrl.includes('policy') || cleanUrl.includes('-cms')) {
            const pageName = url.split('/').pop()?.replace(/-cms$/, '').replace(/^policy-/, 'policy ') || 'CMS page';
            return {
                module: AuditModule.CMS,
                action: AuditAction.CMS_UPDATED,
                targetType: AuditTargetType.CMS,
                summary: `Updated CMS page: "${pageName}"`,
                targetId: params?.id || targetId
            };
        }

        // 11. User Management
        if (cleanUrl.includes('/user')) {
            const userEmail = body?.email || '';
            const newRole = body?.role ? ` (Role: ${body.role})` : '';
            return {
                module: AuditModule.USER,
                action: AuditAction.USER_ROLE_UPDATED,
                targetType: AuditTargetType.USER,
                summary: `${method === 'DELETE' ? 'Deleted' : 'Updated'} user account ${userEmail || params?.id || targetId || ''}${newRole}`,
                targetId: params?.id || targetId
            };
        }

        // Generic Fallback
        const routeSegment = url.replace(/^\/api\/v1\//, '').split('/')[0] || 'system';
        return {
            module: AuditModule.SETTINGS,
            action: AuditAction.GENERIC_MUTATION,
            targetType: AuditTargetType.SETTING,
            summary: `${method} mutation on /${routeSegment}`,
            targetId: params?.id || targetId
        };
    }
}
