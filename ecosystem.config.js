/**
 * PM2 process file.
 *
 * The app runs as exactly ONE Node process. Socket.IO rooms (admin_room, user_*, conv_*)
 * live in process memory, and there is no Redis adapter to share them between workers:
 * with two workers, an order event emitted by worker A never reaches an admin whose socket
 * is connected to worker B. Scale vertically, or add a Socket.IO Redis adapter before
 * raising the instance count.
 *
 * `cluster` mode with one instance is kept so `pm2 reload` restarts without downtime.
 */
const SOCKET_SAFE_INSTANCES = 1;

const rawInstances = process.env.PM2_INSTANCES;
if (rawInstances !== undefined && rawInstances.trim() !== '' && Number(rawInstances) !== SOCKET_SAFE_INSTANCES) {
    throw new Error(
        `[PM2 Config Error] PM2_INSTANCES=${rawInstances} is not supported: Socket.IO state is in-memory, ` +
            `so the app must run as a single process. Unset PM2_INSTANCES or set it to ${SOCKET_SAFE_INSTANCES}.`
    );
}

module.exports = {
    apps: [
        {
            name: 'bazaarbound-backend',
            script: 'dist/main.js',
            instances: SOCKET_SAFE_INSTANCES,
            exec_mode: 'cluster',
            watch: false,
            max_memory_restart: '1G',
            listen_timeout: 8000,
            kill_timeout: 5000,
            env: {
                NODE_ENV: 'production',
                PM2_INSTANCES: String(SOCKET_SAFE_INSTANCES),
                AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE: '1',
            },
        },
    ],
};
