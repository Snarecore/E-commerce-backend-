<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Courier: Steadfast

Code: `src/module/courier`. Disabled by default; the manual `PATCH /orders/:id/courier` keeps working.

Environment:

| Variable | Required | Notes |
|---|---|---|
| `STEADFAST_ENABLED` | yes | `true` to turn the integration on |
| `STEADFAST_API_KEY`, `STEADFAST_SECRET_KEY` | when enabled | From the Steadfast merchant panel |
| `STEADFAST_WEBHOOK_TOKEN` | recommended | Random string, 32+ chars. Register `POST {BACKEND_PUBLIC_URL}/api/v1/courier/webhooks/steadfast` with this token as the Bearer token in the Steadfast panel. Without it, status updates come only from hourly polling. |
| `STEADFAST_BASE_URL` | no | Default `https://portal.packzy.com/api/v1` |
| `STEADFAST_TRACKING_URL_TEMPLATE` | no | Default `https://steadfast.com.bd/t/{tracking_code}` |

Run the migration `CreateShipmentTables1787445000000` before enabling.

Rules:
- Only orders in `Order Placed` / `Processing` can be booked. Booking moves the order to `Shipped`.
- Order code is the Steadfast `invoice`. After an uncertain failure, the next attempt looks up the invoice before creating again (no duplicate parcels).
- Courier `delivered` moves the order to `Delivered` but a COD order stays unpaid until an admin records the Steadfast payout ("Mark COD received").
- Courier `cancelled` moves the order to `Returned` (no restock). Stock comes back only through the RMA inspection.
- Partial delivery, unknown statuses and failed order transitions set `needsAttention` on the shipment (`GET /courier/shipments?needsAttention=true`).

## Deployment

Production runs on a VPS under PM2 (`ecosystem.config.js`). The Vercel entry point (`api/index.ts`) shares the same HTTP setup but cannot hold WebSocket connections or run cron jobs, so real-time events and background workers only work under PM2.

```bash
pnpm install --frozen-lockfile
pnpm run build                 # outputs dist/main.js
pnpm run migration:run         # back up the database first
pm2 start ecosystem.config.js  # or: pm2 reload bazaarbound-backend
```

**Single process.** Socket.IO rooms, the session-status cache and auth events live in memory, so the app must run as exactly one Node process. `ecosystem.config.js` refuses `PM2_INSTANCES` other than 1. Scaling out requires a Socket.IO Redis adapter first.

**Node.js ≥ 22.12** (see `engines`).

### Configuration added by the security hardening

| Variable | Default | Purpose |
|---|---|---|
| `TRUST_PROXY_HOPS` | `1` | Number of reverse proxies in front of Node (nginx/Cloudflare). Drives `req.ip` for rate limits, audit logs and IP blacklists. Set `0` if Node is exposed directly, or clients can spoof their IP. |
| `ADMIN_URL` | – | Admin panel origin. Used for CORS/CSRF and to pick the admin identity on sockets when a browser holds both cookies. |
| `STORE_UTC_OFFSET` | `+06:00` | Shop time zone for report day boundaries. |
| `PHONE_HMAC_SECRET_V1/V2` | public default | Must be set in production; phone hashes made with the default key are reversible. Changing them requires re-hashing stored phone hashes. |

### Request rules worth knowing

- **CSRF:** state-changing requests authenticated by cookie must come from an allowed origin (`ALLOWED_ORIGINS`, `ADMIN_URL`, …). Bearer-token and `@Public` routes are not affected.
- **Uploads:** JPEG/PNG/WebP/GIF/AVIF (and PDF where allowed), checked by file content; 5 MB for customers, 10 MB for admin media. SVG is rejected.
- **Errors:** unexpected server errors return a generic message with an `errorId`; look that id up in the logs.
- **Lists:** every list endpoint returns at most 100 items per page.

### Dependency overrides

Security overrides for transitive dependencies live in `package.json` → `pnpm.overrides` (read by the pinned pnpm 10.4). When upgrading pnpm past 10.5, move them to `pnpm-workspace.yaml` → `overrides`.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
