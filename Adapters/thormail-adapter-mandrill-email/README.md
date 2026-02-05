# Mandrill Email Adapter for ThorMail

Adapter for [ThorMail](https://thormail.io), the professional self-hosted delivery orchestration server.

> [!IMPORTANT]
> To use this adapter, you must have a running instance of **ThorMail** installed.
> This adapter is designed to be installed and managed directly from the ThorMail **Admin Panel**.

Allows you to send transactional emails via **Mailchimp's Mandrill Transactional API**.

## Installation

1. Go to your **ThorMail Admin Panel**.
2. Navigate to the **Adapters** section.
3. Click **Add New Adapter**.
4. Search for `thormail-adapter-mandrill-email` and click **Install**.

## Configuration

In your ThorMail dashboard, navigate to **Adapters** and select **Mandrill Email**.

### Required Fields

* **API Key**: Your Mandrill API Key. Get it from [Settings > SMTP & API Info](https://mandrillapp.com/settings) in your Mandrill dashboard.
* **From Email**: The sender address. Must be a verified domain in your Mandrill account.

### Optional Fields

* **From Name**: The friendly name displayed to recipients (e.g., "My App Support").
* **Subaccount ID**: Default subaccount to use for sending. Can be overridden per message.
* **Webhook Authentication Key**: Secret key to verify webhook signatures.
* **Webhook URL**: The exact URL configured in Mandrill for webhooks (required for signature verification).
* **Adapter Name**: Internal name for this adapter instance.

## Features

* **Subaccounts**: Full support for Mandrill subaccounts, configurable globally or per-message.
* **Streaming Attachments**: Remote attachments are downloaded efficiently using streaming.
* **Webhook Verification**: HMAC-SHA1 signature verification for webhook authenticity.
* **Rich Tracking**: Support for opens, clicks, tags, metadata, and Google Analytics.
* **Dynamic Options**: Pass provider-specific options through the `data` object.

## Attachments

You can send attachments by including an `attachments` array in the `data` object.

```json
{
  "attachments": [
    {
      "filename": "invoice.pdf",
      "path": "https://example.com/invoice.pdf"
    },
    {
      "filename": "report.xlsx",
      "url": "https://example.com/report.xlsx",
      "type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
  ]
}
```

### Supported Properties

* **filename** or **name**: Name of the file.
* **path**, **href**, or **url**: Remote URL to download the file from.
  * **Security**: Must be a valid `http://` or `https://` URL. Local paths are **blocked**.
* **content**: Base64-encoded file content (if not using a URL).
* **type**: MIME type of the file (auto-detected if using URL).

## Inline Images

For embedding images in HTML content, add a `cid` property to your attachment. Attachments with a CID are automatically treated as inline images:

```json
{
  "attachments": [
    {
      "filename": "invoice.pdf",
      "path": "https://example.com/invoice.pdf"
    },
    {
      "filename": "logo.png",
      "url": "https://example.com/logo.png",
      "cid": "logo"
    }
  ]
}
```

Reference inline images in HTML: `<img src="cid:logo">`

> [!NOTE]
> Attachments with a `cid` (or `content_id`/`contentId`) go to Mandrill's `message.images` array.
> Attachments without a CID go to Mandrill's `message.attachments` array.

## Subaccounts

Set a default subaccount in the adapter configuration, or override per message:

```json
{
  "subaccount": "client-123"
}
```

## Dynamic Data Options

The following fields can be passed in the `data` object:

| Field | Description |
|-------|-------------|
| `subaccount` | Subaccount ID to use for this message |
| `tags` | Array of tag strings for categorization |
| `metadata` | Object of custom metadata key-value pairs |
| `headers` | Custom email headers |
| `cc` | CC recipients (string or array) |
| `bcc` | BCC recipients (string or array) |
| `replyTo` | Reply-To email address |
| `text` | Plain text version of the email |
| `trackOpens` | Boolean to enable/disable open tracking |
| `trackClicks` | Boolean to enable/disable click tracking |
| `ip_pool` | IP pool to use for sending |
| `send_at` | Scheduled send time (UTC timestamp or ISO 8601) |
| `global_merge_vars` | Global merge variables |
| `merge_vars` | Per-recipient merge variables |
| `google_analytics_domains` | Domains for GA tracking |
| `google_analytics_campaign` | Campaign name for GA |

## Webhooks

To receive delivery status updates:

1. Go to [Mandrill Webhooks Settings](https://mandrillapp.com/settings/webhooks)
2. Add a new webhook pointing to your ThorMail webhook URL
3. Copy the **Webhook Authentication Key** to your adapter configuration
4. Enter the exact **Webhook URL** in the adapter configuration

### Supported Events

| Mandrill Event | ThorMail Status |
|----------------|-----------------|
| `delivered` | DELIVERED |
| `hard_bounce` | HARD-REJECT |
| `soft_bounce` | SOFT-REJECT |
| `open` | OPENED |
| `click` | CLICKED |
| `spam` | COMPLAINED |
| `reject` | HARD-REJECT |

## API Reference

* [Mandrill Send Message](https://mailchimp.com/developer/transactional/api/messages/send-new-message/)
* [Mandrill Webhooks](https://mailchimp.com/developer/transactional/docs/webhooks/)
* [Error Glossary](https://mailchimp.com/developer/transactional/docs/error-glossary/)

## License

ISC
