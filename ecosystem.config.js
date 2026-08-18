module.exports = {
    apps: [
        {
            name: 'bazaarbound-backend',
            script: 'dist/main.js', // adjust if your entry file is different
            watch: ['./dist'],
            env: {
                NODE_ENV: 'production',
                AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE: '1',
            },
        },
    ],
};
