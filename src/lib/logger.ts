import pino from 'pino';
import { trace, context as otelContext } from '@opentelemetry/api';

/**
 * Create a structured logger with OpenTelemetry trace context
 */
export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => {
            return { level: label };
        },
    },
    base: {
        service: 'scorejudge',
        environment: process.env.NODE_ENV || 'development',
    },
    // In development, use pretty printing
    transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
        }
    } : undefined,
});

/**
 * Get current trace context (trace_id and span_id)
 */
function getTraceContext() {
    const span = trace.getSpan(otelContext.active());
    if (!span) {
        return {};
    }

    const spanContext = span.spanContext();
    return {
        trace_id: spanContext.traceId,
        span_id: spanContext.spanId,
        trace_flags: spanContext.traceFlags,
    };
}

/**
 * Create a child logger with trace context and additional context
 */
export function createLogger(context: {
    userId?: string;
    userEmail?: string;
    gameId?: string;
    gameName?: string;
    [key: string]: any;
}) {
    const traceContext = getTraceContext();

    return logger.child({
        ...traceContext,
        user_id: context.userId,
        user_email: context.userEmail,
        game_id: context.gameId,
        game_name: context.gameName,
        ...context,
    });
}

/**
 * Log with automatic trace context
 */
export function logWithContext(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    context?: {
        userId?: string;
        userEmail?: string;
        gameId?: string;
        gameName?: string;
        [key: string]: any;
    }
) {
    const log = context ? createLogger(context) : logger;
    const traceContext = getTraceContext();

    log[level]({
        ...traceContext,
        ...context,
    }, message);
}
