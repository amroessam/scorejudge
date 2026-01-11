import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { trace, context, SpanStatusCode, Span, SpanKind } from '@opentelemetry/api';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';

const OTEL_EXPORTER_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

let sdkInitialized = false;

/**
 * Initialize OpenTelemetry SDK
 */
export function initTracing() {
    if (sdkInitialized) {
        return;
    }

    // Only active if endpoint is provided OR in development
    const isActive = !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT || (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV);
    if (!isActive) {
        console.log('[Tracing] OpenTelemetry SDK disabled (no endpoint configured)');
        return;
    }

    const exporter = new OTLPTraceExporter({
        url: `${OTEL_EXPORTER_ENDPOINT}/v1/traces`,
    });

    const sdk = new NodeSDK({
        resource: resourceFromAttributes({
            [ATTR_SERVICE_NAME]: 'scorejudge',
            [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '0.1.0',
        }),
        traceExporter: exporter,
        instrumentations: [
            new HttpInstrumentation(),
            new PinoInstrumentation(),
        ],
    });

    sdk.start();
    sdkInitialized = true;
    console.log('[Tracing] OpenTelemetry SDK initialized');

    // Graceful shutdown (only in Node.js environment, not Edge)
    if (typeof process !== 'undefined' && typeof process.on === 'function') {
        process.on('SIGTERM', () => {
            sdk.shutdown()
                .then(() => console.log('[Tracing] SDK shut down successfully'))
                .catch((error) => console.error('[Tracing] Error shutting down SDK', error));
        });
    }
}

/**
 * Get the tracer instance
 */
export function getTracer() {
    return trace.getTracer('scorejudge');
}

/**
 * Trace context attributes for user and game
 */
export interface TraceContext {
    userId?: string;
    userEmail?: string;
    gameId?: string;
    gameName?: string;
}

/**
 * Create a span with common attributes
 */
export function createSpan(
    name: string,
    traceContext: TraceContext = {},
    kind: SpanKind = SpanKind.INTERNAL
): Span {
    const tracer = getTracer();
    const span = tracer.startSpan(name, { kind });

    // Add common attributes
    if (traceContext.userId) {
        span.setAttribute('user.id', traceContext.userId);
    }
    if (traceContext.userEmail) {
        span.setAttribute('user.email', traceContext.userEmail);
    }
    if (traceContext.gameId) {
        span.setAttribute('game.id', traceContext.gameId);
    }
    if (traceContext.gameName) {
        span.setAttribute('game.name', traceContext.gameName);
    }

    return span;
}

/**
 * Wrap an async function with tracing
 */
export async function withSpan<T>(
    name: string,
    traceContext: TraceContext,
    fn: (span: Span) => Promise<T>
): Promise<T> {
    const span = createSpan(name, traceContext, SpanKind.INTERNAL);

    try {
        const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
    } catch (error: any) {
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error?.message || 'Unknown error',
        });
        span.recordException(error);
        throw error;
    } finally {
        span.end();
    }
}

/**
 * Add error to the current span
 */
export function recordError(span: Span, error: any) {
    span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error?.message || 'Unknown error',
    });
    span.recordException(error);
}

/**
 * Create an API route handler wrapper with tracing
 */
export function withTracing<T>(
    operationName: string,
    handler: (span: Span) => Promise<T>,
    traceContext: TraceContext = {}
): Promise<T> {
    return withSpan(operationName, traceContext, handler);
}

/**
 * Extract trace context from request for WebSocket or API
 */
export function extractTraceContext(userEmail?: string, userId?: string, gameId?: string): TraceContext {
    return {
        userEmail,
        userId,
        gameId,
    };
}
