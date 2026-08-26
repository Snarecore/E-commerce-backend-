module.exports = {
    apps: [
        {
            name: 'bazaarbound-backend',
            script: 'dist/main.js',
            instances: 'max',
            exec_mode: 'cluster',
            watch: false,
            env: {
                NODE_ENV: 'production',
                AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE: '1',
            },
        },
    ],
};
