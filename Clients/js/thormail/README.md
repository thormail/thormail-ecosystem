# @thormail/client

Official Node.js client for the **ThorMail Self-Hosted** API. Queue-based delivery for **email**, **SMS**, **push notifications**, and **webhooks**.

For more information about ThorMail, visit [thormail.io](https://thormail.io).

[![npm version](https://img.shields.io/npm/v/@thormail/client)](https://www.npmjs.com/package/@thormail/client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> [!CAUTION]
> **SECURITY WARNING: SERVER-SIDE USE ONLY**
>
> This client is designed exclusively for **Node.js** (backend) environments.
> **NEVER** use this client in browser-based applications (React, Vue, etc.) as it will expose your Workspace ID and API Key to the public. exposure of these credentials can lead to unauthorized usage of your ThorMail instance.

## Features

- � **Server-Side Optimized** - Exclusive for Node.js backends
- 🔒 **Secure** - Designed to keep your credentials safe on the server
- 📦 **Zero Dependencies** - Lightweight and fast
- 🔄 **Auto-retry** - Exponential backoff with jitter for reliability

## Installation

```bash
npm install @thormail/client
```

```bash
yarn add @thormail/client
```

```bash
pnpm add @thormail/client
```

## Quick Start (Node.js)

```javascript
import { ThorMailClient } from '@thormail/client';

// Initialize with your Self-Hosted instance headers
const client = new ThorMailClient({
  baseUrl: 'https://api.your-thormail-server.com', // Your implementation URL
  workspaceId: 'your-workspace-id',
  apiKey: 'your-api-key'
});

// Send a single email
try {
  const result = await client.send({
    to: 'user@example.com',
    subject: 'Welcome!',
    body: '<h1>Hello {{name}}!</h1>',
    data: { name: 'John' }
  });
  console.log('Queued with ID:', result.id);
} catch (error) {
  console.error('Delivery failed:', error.message);
}
```

## Usage

### Initialization

```javascript
import { ThorMailClient, createClient } from '@thormail/client';

// Using constructor
const client = new ThorMailClient({
  baseUrl: 'https://api.your-thormail-server.com',
  workspaceId: 'your-workspace-id',
  apiKey: 'your-api-key',
  timeout: 30000,
  retry: {
    maxRetries: 3,
    baseDelay: 1000
  }
});
```

### Send Single Message

```javascript
// With template
const result = await client.send({
  to: 'user@example.com',
  templateId: 'welcome-email',
  data: {
    name: 'John Doe',
    verificationCode: 'ABC123'
  }
});

// With inline content
const result = await client.send({
  to: 'user@example.com',
  subject: 'Order Confirmation',
  body: `
    <h1>Thanks for your order, {{name}}!</h1>
    <p>Order #{{orderId}} has been confirmed.</p>
  `,
  data: {
    name: 'John',
    orderId: 'ORD-12345'
  }
});

// Schedule for later
const result = await client.send({
  to: 'user@example.com',
  templateId: 'reminder',
  scheduledAt: '2024-12-25T09:00:00Z'
});
```

### Send SMS

```javascript
const result = await client.send({
  to: '+1234567890',
  type: 'SMS',
  body: 'Your verification code is: 123456',
  data: {
    from_number: '+0987654321'
  }
});
```

### Send Push Notification

```javascript
const result = await client.send({
  to: 'device-token-here',
  type: 'PUSH',
  subject: 'New Message',
  body: 'You have a new message from John',
  data: {
    sound: 'default',
    badge: 1
  }
});
```

### Send Batch Messages

```javascript
const result = await client.sendBatch({
  templateId: 'newsletter',
  emails: [
    { to: 'alice@example.com', data: { name: 'Alice', promo: 'SAVE20' } },
    { to: 'bob@example.com', data: { name: 'Bob', promo: 'SAVE15' } },
    { to: 'charlie@example.com', data: { name: 'Charlie' } }
  ]
});

console.log(`Queued ${result.count} messages`);
console.log('Queue IDs:', result.ids);
```

## API Reference

### `ThorMailClient`

#### Constructor Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `baseUrl` | string | Yes | - | URL of your ThorMail Self-Hosted API |
| `workspaceId` | string | Yes | - | Your workspace identifier |
| `apiKey` | string | Yes | - | Your private workspace API key |
| `timeout` | number | No | 30000 | Request timeout in milliseconds |
| `retry.maxRetries` | number | No | 3 | Maximum retry attempts |

#### Methods

- `send(payload: MessagePayload)`: Queue a single message.
- `sendBatch(payload: BatchPayload)`: Queue multiple messages efficiently.
- `configure(config)`: Update client configuration at runtime.
- `getConfig()`: Get current configuration (sanitized).

### `ThorMailError`

Custom error class with helper methods:

- `isRateLimited()`: 429 Too Many Requests
- `isAuthError()`: 401 Unauthorized
- `isSuppressed()`: 403 Recipient Suppressed
- `isRetryable()`: Network errors or 5xx server errors

## Requirements

- **Node.js 18+**
- A running instance of **ThorMail Self-Hosted**

## License

MIT © ThorMail
