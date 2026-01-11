// Elastic APM must be started BEFORE any other modules
const apm = require('elastic-apm-node').start({
    serviceName: 'scorejudge',
    serverUrl: process.env.ELASTIC_APM_SERVER_URL || 'http://localhost:8200',
    environment: process.env.NODE_ENV || 'development',
    // Only activate if URL is provided OR we are in development
    active: !!process.env.ELASTIC_APM_SERVER_URL || (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV),

    // Capture custom context
    captureBody: 'all',
    captureHeaders: true,

    // Enable distributed tracing
    usePathAsTransactionName: true,

    // Log level
    logLevel: 'info',

    // Custom labels for all transactions
    globalLabels: {
        service: 'scorejudge'
    }
});

module.exports = apm;
