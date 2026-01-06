# Delivery API

The Delivery API allows you to queue messages and data payloads for asynchronous processing through your configured adapters. While initially designed for email, the system is provider-agnostic and supports various channels including **Email**, **SMS**, **Push Notifications**, and **Webhooks**.

## Overview

ThorMail uses a **queue-based architecture** for reliable delivery. When you send a payload through the API, it is added to a processing queue and handled asynchronously by the worker service. The specific behavior (sending an email, dispatching an SMS, calling a webhook) is determined by the active **Provider Adapter**.

This ensures:

- **High availability**: The API responds immediately without waiting for the downstream provider.
- **Reliability**: Failed deliveries are automatically retried with exponential backoff.
- **Flexibility**: Switch between providers or channels (e.g., SendGrid to Twilio) just by changing the adapter rules, without changing API code.

## Authentication

All email endpoints require **API Key authentication** via HTTP headers:

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `X-Workspace-ID` | integer | Yes | Your workspace identifier |
| `X-API-Key` | string | Yes | Your workspace API key |

> [!IMPORTANT]
> Keep your API key secure. Never expose it in client-side code or public repositories.

## Base URL

```
https://your-api-host.com/v1
```

---

## Rate Limiting

The API enforces rate limits using a **dual-layer system** to protect against abuse while allowing generous usage for legitimate applications.

### Limits

| Layer | Scope | Limit | Window |
|-------|-------|-------|--------|
| **Workspace** | Per API Key | 1,000 requests | 1 minute |
| **Workspace (Batch)** | Per API Key | 50 requests | 1 minute |
| **IP** | Per IP Address | 100 requests | 1 minute |
| **Batch Size** | Per Request | 500 emails | - |

### Response Headers

All responses include rate limit headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed per window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when the limit resets |
| `Retry-After` | Seconds to wait (only on 429 responses) |

### Rate Limit Exceeded (429)

When rate limited, the API returns a `429 Too Many Requests` response:

```json
{
  "error": "Rate limit exceeded for this workspace",
  "retryAfter": 45
}
```

> [!TIP]
> Implement exponential backoff in your client. When you receive a 429 response, wait for the `retryAfter` seconds before retrying.

## Endpoints

### Send Single Message

Queue a single payload for delivery. The nature of the delivery depends on the configured adapter for the workspace or specific rule.

```
POST /v1/send
```

#### Request Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `X-Workspace-ID` | Your workspace ID |
| `X-API-Key` | Your API key |

#### Request Body

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | No | Message type (`EMAIL`, `SMS`, `PUSH`, `WEBHOOK`, etc.). Defaults to `EMAIL`. <br> - `EMAIL`: Validates recipient format & checks suppression list.<br>- `SMS`: Checks suppression list.<br>- Others: No validation/suppression checks. |
| `to` | string | Yes | Recipient identifier (Email, Phone Number, Device Token, etc.) |
| `subject` | string | No | Message title or subject. Required if expected by the provider/template. |
| `body` | string | No | Main content (HTML, Text, JSON). Required if expected by the provider/template. |
| `data` | object | No | Key-value pairs for template substitution or raw data payload |
| `templateId` | string | No | ID of a stored template to use |
| `scheduledAt` | string | No | ISO 8601 timestamp to schedule delivery (max 3 days in future) |
| `adapterId` | string | No | Specific adapter identifier to bypass the rule engine and route directly to the specified adapter |

#### Adapter Pass-through & Template Data

All fields provided in the `data` object serve a dual purpose:

1. **Adapter options**: The entire `data` object is passed to the configured adapter. Use this for provider-specific fields (e.g., `cc`, `bcc`, `reply_to`, `headers` for Email; `validity_period` for SMS).
2. **Template variables**: Keys in the `data` object are available for variable substitution in your `subject` and `body` (e.g., `{{name}}`).

Examples of fields to place inside `data`:

- **Email**: `cc`, `bcc`, `reply_to`, `headers`, `attachments`
- **SMS**: `from_number`, `validity_period`
- **Push**: `sound`, `badge`, `click_action`
- **Webhook**: `callback_url`, `auth_token`

> [!NOTE]
> Support for specific fields depends entirely on the active provider adapter.

#### Example Request

```bash
curl -X POST https://api.thormail.example.com/v1/send \
  -H "Content-Type: application/json" \
  -H "X-Workspace-ID: 1" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "to": "recipient@example.com",
    "templateId": "tmpl_12345",
    "data": {
      "name": "John Doe",
      "order_id": "12345"
    }
  }'
```

#### Response

**Success (202 Accepted)**

```json
{
  "id": 12345,
  "status": "accepted"
}
```

**Error (400 Bad Request)**

```json
{
  "error": "Missing \"to\" field"
}
```

**Error (403 Forbidden)**

```json
{
  "error": "Recipient is suppressed",
  "code": "suppression_list"
}
```

**Error (401 Unauthorized)**

```json
{
  "error": "Missing authentication headers"
}
```

---

### Send Batch Messages

Queue multiple messages for delivery in a single request. All messages share the same base content and template, with per-recipient personalization.

```
POST /v1/send-batch
```

#### Request Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `X-Workspace-ID` | Your workspace ID |
| `X-API-Key` | Your API key |

#### Request Body

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | No | Shared message type. Defaults to `EMAIL` (see Single Message for details). |
| `emails` | array | Yes | **Legacy Name**. List of recipient objects (max 100). |
| `subject` | string | No | Shared title/subject |
| `body` | string | No | Shared content body |
| `templateId` | string | No | Shared template ID |
| `scheduledAt` | string | No | Shared ISO 8601 schedule time (max 30 days in future) |
| `adapterId` | string | No | Shared adapter identifier to bypass the rule engine for all messages in the batch |

**Recipient Object**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | string | Yes | Recipient identifier (Email, Phone, etc.) |
| `data` | object | No | Per-recipient variables/data |

#### Adapter Pass-through & Template Data

Similar to single messages, the per-recipient `data` object is passed to the adapter and used for template rendering.

- **Email**: Place `cc`, `bcc`, etc. inside the recipient's `data` object.
- **General**: Any adapter-specific options must be in `data`.

#### Example Request

```bash
curl -X POST https://api.thormail.example.com/v1/send-batch \
  -H "Content-Type: application/json" \
  -H "X-Workspace-ID: 1" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "templateId": "tmpl_newsletter",
    "scheduledAt": "2024-01-01T12:00:00Z",
    "emails": [
      {
        "to": "alice@example.com",
        "data": {
          "name": "Alice",
          "week": "Dec 23-30"
        }
      },
      {
        "to": "bob@example.com",
        "data": {
          "name": "Bob",
          "week": "Dec 23-30"
        }
      }
    ]
  }'
```

#### Response

**Success (202 Accepted)**

```json
{
  "status": "accepted",
  "count": 2,
  "ids": [12345, 12346]
}
```

**Error (400 Bad Request)**

```json
{
  "error": "Missing or invalid \"emails\" list"
}
```

> [!WARNING]
> The batch operation is **atomic**. If any email fails template compilation, the entire batch is rejected and no emails are queued.

---

## Template Data

Both endpoints support dynamic content using **Handlebars-style** template syntax.

### Syntax

Use double curly braces to define placeholders in your subject or body:

```html
<p>Hello {{name}}, your order #{{order_id}} has shipped!</p>
```

### Providing Values

Pass variable values in the `data` object:

```json
{
  "to": "customer@example.com",
  "templateId": "tmpl_shipping",
  "data": {
    "name": "John",
    "order_id": "ORD-12345"
  }
}
```

### Batch Personalization

In batch requests, each recipient can have unique variable values:

```json
{
  "templateId": "tmpl_statement",
  "emails": [
    {
      "to": "alice@example.com",
      "data": { "name": "Alice", "month": "December", "balance": "$150.00" }
    },
    {
      "to": "bob@example.com", 
      "data": { "name": "Bob", "month": "December", "balance": "$75.50" }
    }
  ]
}
```

---

## Response Codes

| Code | Description |
|------|-------------|
| `202` | Email(s) accepted and queued for delivery |
| `400` | Bad request - missing fields, template error, or batch size exceeded |
| `401` | Unauthorized - invalid or missing credentials |
| `403` | Forbidden - Recipient is suppressed |
| `404` | Not Found - Template ID not found |
| `429` | Rate limit exceeded - wait and retry |
| `500` | Internal server error |

---

## Best Practices

1. **Use batch endpoint for multiple emails**: The `/send-batch` endpoint is more efficient than multiple `/send` calls
2. **Validate email addresses**: Ensure recipient addresses are valid before sending
3. **Handle template errors**: Test your templates with sample variables before production use
4. **Store email IDs**: Save returned IDs to track delivery status
5. **Implement retry logic**: Handle 500 errors with exponential backoff on your client

---

## Code Examples

### JavaScript (Node.js)

```javascript
const response = await fetch('https://api.thormail.example.com/v1/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Workspace-ID': '1',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    to: 'recipient@example.com',
    templateId: 'tmpl_welcome', // Optional: Use a template
    data: {                     // Optional: Data for template
      name: 'John Doe'
    }
  })
});

const data = await response.json();
console.log('Email queued with ID:', data.id);
```

### Python

```python
import requests

response = requests.post(
    'https://api.thormail.example.com/v1/send',
    headers={
        'Content-Type': 'application/json',
        'X-Workspace-ID': '1',
        'X-API-Key': 'your-api-key'
    },
    json={
        'to': 'recipient@example.com',
        'templateId': 'tmpl_welcome',
        'data': {
            'name': 'John Doe'
        }
    }
)

data = response.json()
print(f"Email queued with ID: {data['id']}")
```

### cURL

```bash
curl -X POST https://api.thormail.example.com/v1/send \
  -H "Content-Type: application/json" \
  -H "X-Workspace-ID: 1" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "to": "recipient@example.com", 
    "templateId": "tmpl_welcome", 
    "data": {"name": "John Doe"}
  }'
```
