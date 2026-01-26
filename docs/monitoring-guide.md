# Cloud Run Worker Monitoring Guide

## 1. Cloud Logging (Enhanced)

You already have `console.log` which works, but structured logging is better:

```typescript
// src/lib/logger.ts
interface LogEntry {
  severity: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  [key: string]: unknown;
}

export function log(entry: LogEntry) {
  // Cloud Run automatically picks up this format
  console.log(JSON.stringify(entry));
}

// Usage
log({
  severity: 'INFO',
  message: 'Processing cv-uploaded',
  messageId: body.message.messageId,
  userId: data.userId,
});
```

This enables filtering in Cloud Logging by any field.

---

## 2. Error Reporting

Errors with stack traces are auto-captured. Just ensure you log errors properly:

```typescript
// In your catch blocks
catch (error) {
  console.error(JSON.stringify({
    severity: 'ERROR',
    message: 'Failed to process cv-uploaded',
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : error,
    messageId: body.message.messageId,
  }));
  return reply.status(500).send('Failed');
}
```

View at: `https://console.cloud.google.com/errors?project=YOUR_PROJECT`

---

## 3. Cloud Trace (Distributed Tracing)

```bash
npm install @google-cloud/opentelemetry-cloud-trace-exporter @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

```typescript
// src/instrumentation.ts (import FIRST in worker.ts)
import {NodeSDK} from '@opentelemetry/sdk-node';
import {getNodeAutoInstrumentations} from '@opentelemetry/auto-instrumentations-node';
import {TraceExporter} from '@google-cloud/opentelemetry-cloud-trace-exporter';

const sdk = new NodeSDK({
  traceExporter: new TraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

```typescript
// worker.ts
import './instrumentation.ts'; // Must be first!
import 'dotenv/config';
// ... rest of your code
```

View at: `https://console.cloud.google.com/traces?project=YOUR_PROJECT`

---

## 4. Cloud Monitoring (Custom Metrics)

```bash
npm install @google-cloud/opentelemetry-cloud-monitoring-exporter @opentelemetry/sdk-metrics
```

```typescript
// src/metrics.ts
import {MeterProvider, PeriodicExportingMetricReader} from '@opentelemetry/sdk-metrics';
import {MetricExporter} from '@google-cloud/opentelemetry-cloud-monitoring-exporter';

const meterProvider = new MeterProvider({
  readers: [
    new PeriodicExportingMetricReader({
      exporter: new MetricExporter(),
      exportIntervalMillis: 60000,
    }),
  ],
});

const meter = meterProvider.getMeter('worker');

export const messagesProcessed = meter.createCounter('messages_processed', {
  description: 'Number of Pub/Sub messages processed',
});

export const processingDuration = meter.createHistogram('processing_duration_ms', {
  description: 'Message processing duration in milliseconds',
});
```

```typescript
// In your handlers
import {messagesProcessed, processingDuration} from './metrics.ts';

app.post('/events/cv-uploaded', async (request, reply) => {
  const start = Date.now();

  try {
    await cvUploadParsingSubscription.handler(data);
    messagesProcessed.add(1, {event: 'cv-uploaded', status: 'success'});
    return reply.status(200).send('OK');
  } catch (error) {
    messagesProcessed.add(1, {event: 'cv-uploaded', status: 'error'});
    throw error;
  } finally {
    processingDuration.record(Date.now() - start, {event: 'cv-uploaded'});
  }
});
```

---

## 5. Quick Dashboard (No Code)

Create a dashboard in Cloud Monitoring UI:

1. Go to `Monitoring > Dashboards > Create Dashboard`
2. Add charts for:
   - `cloud_run_revision/request_count` (filtered by service)
   - `cloud_run_revision/request_latencies`
   - `pubsub_subscription/num_undelivered_messages`
   - `pubsub_subscription/oldest_unacked_message_age`

---

## 6. Cloud Logging Query Filters

### Quick Access

Open Cloud Logging: `https://console.cloud.google.com/logs/query?project=hiremedev`

### Common Filters

**All Cloud Run logs:**
```
resource.type="cloud_run_revision"
resource.labels.location="europe-west1"
```

**All requests (with method and URL):**
```
resource.type="cloud_run_revision"
resource.labels.location="europe-west1"
jsonPayload.req.url!=""
```

**Errors only:**
```
resource.type="cloud_run_revision"
resource.labels.location="europe-west1"
severity>=ERROR
```

**Specific endpoint (regex match):**
```
resource.type="cloud_run_revision"
jsonPayload.req.url=~"/api/cv"
```

**Specific service:**
```
resource.type="cloud_run_revision"
resource.labels.service_name="core-api"
```

**Worker service:**
```
resource.type="cloud_run_revision"
resource.labels.service_name="core-worker"
```

**By time range (last 5 minutes):**
```
resource.type="cloud_run_revision"
resource.labels.location="europe-west1"
timestamp>="2026-01-26T09:55:00Z"
```

### CLI Commands

**Stream logs in real-time:**
```bash
gcloud beta logging tail 'resource.type="cloud_run_revision" AND resource.labels.location="europe-west1"' --project=hiremedev
```

**Read recent logs:**
```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.location="europe-west1"' --project=hiremedev --limit=50 --freshness=10m
```

**Read errors only:**
```bash
gcloud logging read 'resource.type="cloud_run_revision" AND severity>=ERROR' --project=hiremedev --limit=20 --freshness=1h
```

### Cloud Run Service Logs (Simplified)

**Read recent logs:**
```bash
gcloud run services logs read core-api --project=hiremedev --region=europe-west1 --limit=50
```

**Stream logs in real-time:**
```bash
gcloud beta run services logs tail core-api --project=hiremedev --region=europe-west1
```

**Stream worker logs:**
```bash
gcloud beta run services logs tail core-worker --project=hiremedev --region=europe-west1
```

### Detailed Error Investigation

**Get full error details as JSON:**
```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="core-api" AND severity>=ERROR' --project=hiremedev --limit=5 --freshness=5m --format=json
```

**Get application error messages:**
```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="core-api" AND jsonPayload.message:*' --project=hiremedev --limit=10 --freshness=5m --format="json(jsonPayload)"
```

---

## Recommended Starting Point

If you want minimal setup, just do **#1 (structured logging)** and **#2 (error reporting)** - they require almost no code changes and give you the most value. Add tracing and custom metrics later when you need to debug performance issues.

---

## Useful Links

- [Cloud Logging](https://console.cloud.google.com/logs)
- [Error Reporting](https://console.cloud.google.com/errors)
- [Cloud Trace](https://console.cloud.google.com/traces)
- [Cloud Monitoring Dashboards](https://console.cloud.google.com/monitoring/dashboards)
