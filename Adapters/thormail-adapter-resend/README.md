# Resend Adapter for ThorMail

Adapter for [ThorMail](https://thormail.io), the professional self-hosted delivery orchestration server.

> [!IMPORTANT]
> To use this adapter, you must have a running instance of **ThorMail** installed.
> This adapter is designed to be installed and managed directly from the ThorMail **Admin Panel**.

Allows you to send transactional and marketing emails via **Resend** using their official API.

## Installation

1. Go to your **ThorMail Admin Panel**.
2. Navigate to the **Adapters** section.
3. Click **Add New Adapter**.
4. Search for `thormail-adapter-resend` and click **Install**.

## Configuration

In your ThorMail dashboard, navigate to **Connections** and select **Resend**.

### Required Fields

* **API Key**: Your Resend API Key. You can generate one in your [Resend Dashboard](https://resend.com/api-keys).
* **From Email**: The sender address. **Must be verified** in your Resend account.

### Optional Fields

* **From Name**: The friendly name displayed to recipients (e.g., "My App Support").
* **Webhook Signing Secret**: Secret used to verify webhook signatures if you are receiving events from Resend.
* **Adapter Name**: Internal name for this adapter instance.

## Features

* **High Deliverability**: Leverages Resend's premium infrastructure.
* **Idempotency**: Automatic handling of idempotency keys for safe retries.
* **Webhooks**: Built-in verification and processing of Resend webhook events.
* **Rich Content**: Full support for HTML, Attachments, Tags, and Custom Headers.
* **SHA1 Idempotency**: Secures idempotency keys using SHA1 hashing.

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
      "filename": "logo.png",
      "path": "https://example.com/logo.png",
      "cid": "unique-logo-id"
    }
  ]
}
```

### Supported Properties

* **filename**: Name of the file.
* **path**: URL of the file.
  * **Security**: Must be a valid `http://` or `https://` URL. Local paths are **blocked**.
* **content**: File content as a string. The adapter automatically converts this to base64 for the Resend API.
* **cid** (or `content_id`): Content ID for inline images.

> [!NOTE]
> For maximum efficiency, use `path` with a public URL. This allows Resend to fetch the file directly.

## License

ISC
