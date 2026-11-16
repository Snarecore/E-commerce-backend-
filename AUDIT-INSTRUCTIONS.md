# Admin, Backend, Frontend Audit: Ki Thik Korte Hobe

Audit-er tarikh: 14 November 2026. Tinta project dekha hoyeche: `Cloth-backend`, admin panel ar customer frontend.

## 1. Ekhoni thik kora dorkar (security ar taka)

| # | Problem | Kothay | Ki hote pare |
|---|---|---|---|
| 1 | Product edit ar delete `@Public` | `Cloth-backend/src/module/inventory/product/product.controller.ts:77,109` | Login chhara jekeu shob product-er dam 0 kore dite pare ba muchhe dite pare |
| 2 | Refresh token verify na hole `decode()` kore token-e bharsha kore | `Cloth-backend/src/module/auth/auth.service.ts:370-377` | Jal (forged) token diye admin token paoa jay |
| 3 | `GET /orders/:id` public, ar order ID matro 6 digit-er random | `order.controller.ts:147` | Script chaliye shob customer-er address, phone, payment-er tottho ber kora jay |
| 4 | Coupon, role ar review delete-e `@Roles` nei | `coupon.controller.ts`, `roles.controller.ts`, `product-review.controller.ts:52` | Jekono customer 100% discount coupon banate pare |
| 5 | Payment-er attempts ar retry public, ownership check hoy na | `payments.controller.ts:285,298` | Onner order-er payment-er tottho dekha jay |
| 6 | Currency client theke ashe | frontend `checkout/index.tsx:245` (`"usd"`) | Screen-e ৳2060 dekhay, kintu Stripe $2060 charge kore |
| 7 | Ekta `paymentIntentId` bar bar beboher kora jay | `order.service.ts:364-394` | Ekbar payment kore onekgulo PAID order |
| 8 | Product description HTML sanitize na kore dekhano hoy | admin `ProductDetails.tsx:357`, frontend JSON-LD `product/index.tsx:367` | XSS diye admin-er session churi |

**Mul karon:** `RolesGuard` emon bhabe lekha je kono route-e `@Roles` na thakle jekono logged-in user dhukte pare (`role.guard.ts:27`). Tai admin panel-er `RoleProtectedRoute` shudhu UI-te atkay, server-e kono suraksha dey na. Default ulte deoa uchit: `@Roles` na thakle request atkabe.

**Note:** Checkout OTP production-e chalu ache (`order.service.ts:292`, env set na thakle default `true`). Eta kono problem na.

## 2. Industry standard na (High/Medium)

### Backend
- Access ar refresh token-er secret ar payload ek, kono `type` claim nei. Token rotation ba revoke korar byabostha nei.
- Order-er owner unverified JWT decode kore thik kora hoy (`order.controller.ts:30-91`).
- Password reset code `Math.random` diye banano, bhul chesta-r kono limit nei.
- Socket-er CORS shob origin allow kore. Rate limit in-memory, tai Vercel-e kaj kore na.
- File upload-e type ba size check nei. Page `limit`-er kono upor shima nei.
- Product-er price float-e rakha (`product.entity.ts:38-47`).
- `payments.service.ts` 2283 line, `order.service.ts` 1937 line. Auth, coupon, product-er kono test nei.

### Frontend
- JWT non-httpOnly cookie ar localStorage-e rakha (`store/user-store.ts:41-53`). Backend-e httpOnly cookie-r helper agei ache, use hocche na.
- `middleware.ts` signature verify kore na, tai eta shudhu dekhano-r jonno protection.
- `.env` git-e commit kora.
- Shop ar category page client-side render hoy, tai SEO-te product-er HTML jay na. Sitemap static.
- Test nei, `any` 190 bar.

### Admin
- Blacklist save fail holeo success toast dekhay (`utils/blacklist-storage.ts:18,41`). Admin bhabe block hoyeche, kintu hoyni.
- Role na thakle default `"admin"` dhore ney (`auth-storage.ts:41,72`).
- 500 line-er beshi component 9-ta. `any` ar `@ts-ignore` onek. Customer-er naam khujte ~20-ta field name try kora hoy (`order-utils.ts`). Test nei.

### Ja bhalo ache
Order create transaction-er moddhe row lock diye hoy, coupon `FOR UPDATE` lock kora, Stripe webhook verify kora, `synchronize: false` ar migration ache, admin httpOnly cookie use kore.

## 3. Backend-e howa uchit, kintu frontend/admin-e kora hocche

### Admin

| Admin ja kore | Kothay | Ki korte hobe |
|---|---|---|
| Alada GET call diye SKU banay, tarpor create-e pathay. SKU endpoint public ar column unique na | `ProductCreation.tsx:528-539` | `ProductService.create`-er bhetore SKU generate korun, column unique korun |
| Category ID-r sathe naam-o pathay, backend client-er naam save kore | `ProductCreation.tsx:484-489` | Server ID theke naam lookup korbe |
| Stock adjustment-er cost client thik kore | `CreateAdjustmentModal.tsx:97,123` | Server-e same fallback agei ache, client-er `unitCost` ignore korun |
| `allowNegativeStock` flag browser theke ashe | `QuickAdjustModal.tsx:66` | Server ba role thik korbe |
| Order status dropdown hardcoded, backend-er state machine-er sathe mele na | `OrderDetail.tsx:17` | GET order-e `allowedNextStatuses` pathan |
| Order-er date filter pathay, backend ignore kore | `orders/index.tsx:92-97` | Backend `OrdersFilterDto`-te date range jog korun |
| 100-ta product load kore browser-e search kore | `CreateAdjustmentModal.tsx:53` | `product/admin-products?searchKeyword=` agei ache |
| Refund korar baki amount browser-e hishab kore | `payments/index.tsx:214-221` | Response-e `remainingRefundable` pathan |
| Unread chat count prothom 100-ta conversation theke jog kore | `useUnreadChatCount.ts` | `GET message/unread-count` endpoint banan |
| Coupon ar blacklist-er pura list ekbare ane | `coupons/index.tsx:46`, `BlacklistPage.tsx` | Pagination agei ache ba jog korun |

### Frontend
Ekhane obostha bhalo. Price, total, coupon ar stock backend DB theke abar hishab kore. Baki fank-gulo:
- Currency backend thik kora uchit.
- Preview fail korle client nijer hishab-kora total dekhay. Tokhon "Place order" atkano uchit.
- Delivery charge "dhaka" free-text-er upor nirbhor kore. Eta zone table-e newa uchit.
- Server-side cart nei.
- `+`/`-` button productId diye kaj kore, tai ek product-er shob size-er quantity bodle jay.

## 4. Kon kram-e thik korben

1. Product, coupon, role ar review route-e `@Roles(ADMIN)` din, ba `RolesGuard`-er default ulte din.
2. Refresh token-er `decode()` fallback muchhe din.
3. Order ar payment-er public route-e ownership ba phone diye verification jog korun.
4. Currency server-e fix korun, `paymentIntentId` unique korun, legacy payment path bad din.
5. Description sanitize korun, frontend-er token httpOnly cookie-te nin.
