import { Logger } from '@nestjs/common';
import { cert, getApps, initializeApp } from 'firebase-admin/app';

const logger = new Logger('FirebaseAdmin');

/**
 * Initializes the Firebase Admin SDK once per process from FIREBASE_PROJECT_ID,
 * FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY. Returns false when it is not configured,
 * so callers can fail closed instead of trusting unverified client data.
 */
export const ensureFirebaseAdmin = (get: (key: string) => string | undefined): boolean => {
	if (getApps().length > 0) return true;

	const projectId = get('FIREBASE_PROJECT_ID') || process.env.FIREBASE_PROJECT_ID;
	const clientEmail = get('FIREBASE_CLIENT_EMAIL') || process.env.FIREBASE_CLIENT_EMAIL;
	const privateKey = get('FIREBASE_PRIVATE_KEY') || process.env.FIREBASE_PRIVATE_KEY;
	if (!projectId || !clientEmail || !privateKey) return false;

	try {
		// Env files store the key with escaped newlines
		initializeApp({ credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }) });
		logger.log(`Firebase Admin SDK initialized for project: ${projectId}`);
		return true;
	} catch (err: any) {
		logger.error(`Failed to initialize Firebase Admin SDK: ${err?.message}`, err?.stack);
		return false;
	}
};
