import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { Public } from './decorators/public.decorator';

@Controller()
export class AppController {
	constructor(private readonly dataSource: DataSource) {}

	@Public()
	@Get()
	getHello() {
		return { status: 'success', message: 'Cloth Backend API is running successfully' };
	}

	/**
	 * 🟢 Liveness Probe (/health/live)
	 * Fast event-loop responsiveness check. Never pings database to prevent restart loops.
	 */
	@Public()
	@Get('health/live')
	getLiveness() {
		return {
			status: 'UP',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
		};
	}

	/**
	 * 🟡 Readiness Probe (/health/ready)
	 * Deep dependency check: verifies TiDB Cloud connection pool with `SELECT 1`.
	 */
	@Public()
	@Get('health/ready')
	async getReadiness(@Res() res: Response) {
		try {
			await this.dataSource.query('SELECT 1');
			return res.status(HttpStatus.OK).json({
				status: 'READY',
				database: 'CONNECTED',
				timestamp: new Date().toISOString(),
			});
		} catch (error: any) {
			return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
				status: 'NOT_READY',
				database: 'DISCONNECTED',
				error: error?.message || 'Database unreachable',
				timestamp: new Date().toISOString(),
			});
		}
	}

	/**
	 * 🔍 Diagnostics Health Probe (/health)
	 * Comprehensive operational status for monitors, dashboards, and developers.
	 */
	@Public()
	@Get('health')
	async getDiagnostics(@Res() res: Response) {
		const mem = process.memoryUsage();
		let dbStatus = 'CONNECTED';
		try {
			await this.dataSource.query('SELECT 1');
		} catch {
			dbStatus = 'DISCONNECTED';
		}

		const isHealthy = dbStatus === 'CONNECTED';
		return res.status(isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
			status: isHealthy ? 'HEALTHY' : 'DEGRADED',
			uptimeSeconds: Math.floor(process.uptime()),
			environment: process.env.NODE_ENV || 'development',
			database: dbStatus,
			memory: {
				heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
				rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
			},
			timestamp: new Date().toISOString(),
		});
	}
}
