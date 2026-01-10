# Telegram Adapter for ThorMail

Adapter for [ThorMail](https://thormail.io), the professional self-hosted delivery orchestration server.

> [!IMPORTANT]
> To use this adapter, you must have a running instance of **ThorMail** installed.
> This adapter is designed to be installed and managed directly from the ThorMail **Admin Panel**.

Allows you to send messages via the Telegram Bot API.

## Installation

1. Go to your **ThorMail Admin Panel**.
2. Navigate to the **Adapters** section.
3. Click **Add New Adapter**.
4. Search for `thormail-adapter-telegram` and click **Install**.

## Configuration

In your ThorMail dashboard, navigate to **Adapters** and select **Telegram**.

### Required Fields

* **Bot Token**: Your Telegram Bot Token obtained from [@BotFather](https://t.me/BotFather).

### Optional Fields

* **Default Chat ID**: The default chat ID to send messages to if not specified in the `to` field.

## Usage

When sending a message via ThorMail using this adapter:

> [!IMPORTANT]
> **Adapter Selection**
> To route messages to this adapter, you must specify `type: 'TELEGRAM'` in your request.
>
> ```javascript
> import { ThorMailClient } from '@thormail/client';
>
> // Initialize with your Self-Hosted instance headers
> const client = new ThorMailClient({
>   baseUrl: 'https://api.your-thormail-server.com', // Your implementation URL
>   workspaceId: 'your-workspace-id',
>   apiKey: 'your-api-key'
> });
>
> const result = await client.send({
>   to: '123456789',
>   type: 'TELEGRAM',
>   body: 'Your verification code is: <b>{{code}}</b>',
>   data: {
>     code: '1234567'
>   }
> });
> ```

### REST API

```bash
curl -X POST https://api.your-thormail-server.com/v1/send \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-Workspace-ID: YOUR_WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "123456789",
    "type": "TELEGRAM",
    "body": "Your verification code is: <b>{{code}}</b>",
    "data": {
      "code": "1234567"
    }
  }'
```
>
> Specifying `type: "TELEGRAM"` ensures the request is routed to any active Telegram adapter.
>
> For advanced use cases, you can still use **Routing Rules** or specific `adapterId`s if strictly necessary, but `type` is the standard way to target this channel.

* **to**: The Telegram **Chat ID**.
* **body**: The message content (HTML is supported by default).
* **subject**: Optional. If provided, it will be displayed in bold at the top of the message.

## Data Parameters

You can pass additional options in the `data` object to customize message behavior:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `_isMarkdown` | `boolean` | `false` | Use **MarkdownV2** formatting instead of HTML. |
| `_disableWebPagePreview` | `boolean` | `false` | Disable link previews in the message. |

### Example with data parameters

```javascript
const result = await client.send({
  to: '123456789',
  type: 'TELEGRAM',
  subject: 'New Order',
  body: '**Order #1234** has been _confirmed_.\n\nDetails: [View Order](https://example.com/orders/1234)',
  data: {
    _isMarkdown: true,
    _disableWebPagePreview: true
  }
});
```

> [!NOTE]
> **Auto-detection**: If you set `_isMarkdown: true` but the body contains HTML tags (like `<b>`, `<i>`, `<p>`), the adapter will automatically switch to HTML mode to prevent formatting errors.

## Features

* **Instant Delivery**: Sends messages directly to Telegram chats or channels.
* **HTML Support**: Supports basic HTML formatting (b, i, u, s, a, code, pre).
* **MarkdownV2 Support**: Full MarkdownV2 support with automatic character escaping.
* **Auto-detection**: Automatically detects HTML in Markdown mode and switches accordingly.
* **Lightweight**: Uses native fetch, no heavy dependencies.

## License

ISC
