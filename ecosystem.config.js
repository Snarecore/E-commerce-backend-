const rawInstances = process.env.PM2_INSTANCES;
let instances = 1; // Default to 1 worker in Phase 1 for deterministic in-memory Socket.io event bus without Redis

if (rawInstances !== undefined && rawInstances !== null && rawInstances.trim() !== '') {
    const parsed = Number(rawInstances);
    if (isNaN(parsed) || !Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`[PM2 Config Error] PM2_INSTANCES must be a valid integer >= 1. Received: "${rawInstances}"`);
    }
    instances = parsed;
}

module.exports = {
    apps: [
        {
            name: 'bazaarbound-backend',
            script: 'dist/main.js',
            instances,
            exec_mode: 'cluster',
            watch: false,
            max_memory_restart: '1G',
            listen_timeout: 8000,
            kill_timeout: 5000,
            env: {
                NODE_ENV: 'production',
                AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE: '1',
            },
        },
    ],
};
