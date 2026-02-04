# SMTP Adapter for ThorMail

Adapter for [ThorMail](https://thormail.io), the professional self-hosted delivery orchestration server.

> [!IMPORTANT]
> To use this adapter, you must have a running instance of **ThorMail** installed.
> This adapter is designed to be installed and managed directly from the ThorMail **Admin Panel**.

Allows you to send emails via any standard SMTP server (e.g., Gmail, Outlook, Amazon SES, SendGrid, Mailgun, Postmark, or your own Postfix/Exim server).

## Installation

1. Go to your **ThorMail Admin Panel**.
2. Navigate to the **Adapters** section.
3. Click **Add New Adapter**.
4. Search for `thormail-adapter-smtp` and click **Install**.

## Configuration

In your ThorMail dashboard, navigate to **Adapters** and select **SMTP**.

### Required Fields

* **SMTP Host**: The hostname or IP address of your SMTP server (e.g., `smtp.gmail.com`).
* **SMTP Port**: The port to connect to (e.g., `587`, `465`, `25`).
* **Username**: Your SMTP username.
* **Password**: Your SMTP password.
* **From Email**: The default sender address.

### Optional Fields

* **Use TLS/SSL**: Enforce SSL connection (usually for port 465).
* **From Name**: The friendly name displayed to recipients.
* **Adapter Name**: Internal name for this adapter instance.

## Features

* **Universal Compatibility**: Works with any provider that supports SMTP.
* **Secure**: Supports STARTTLS and SSL/TLS connections.
* **Authentication**: Supports standard username/password authentication.
* **Lightweight**: Built on top of `nodemailer`.
* **Attachments**: Supports sending files via URL.

## Attachments

You can send attachments by including an `attachments` array in the `data` object. Each attachment should have a `filename` and a `path` (or `href`).

```json
{
  "attachments": [
    {
      "filename": "document.pdf",
      "path": "https://example.com/files/document.pdf",
      "contentType": "application/pdf"
    },
    {
      "filename": "logo.png",
      "href": "https://example.com/logo.png",
      "cid": "unique-logo-id",
      "contentDisposition": "inline"
    }
  ]
}
```

The adapter supports all [Nodemailer attachment options](https://nodemailer.com/message/attachments) that are JSON-serializable.

### Important Considerations

* **Recommended**: Use `path` or `href` for remote files. This is the most efficient method and fully supported.
* **content**: Due to the decoupled nature of ThorMail and its queue system, **Buffers and Streams are NOT supported** as they cannot be serialized to the queue.
  * You may use `content` as a **String**, but use this only when strictly necessary.
  * **Warning**: Large strings in `content` may hit queue size limits and are inefficient. Use `path` or `href` whenever possible.

* **Security**: Local file paths in `path` or `href` are **blocked**. You must use `http://` or `https://` URLs.

## Inline Images (CID)

To use an image inline in your HTML body:

1. Provide a `cid` in the attachment object.
2. Reference it in your HTML: `<img src="cid:unique-logo-id"/>`.

> [!NOTE]
> For maximum efficiency, provide a direct URL to the file. The adapter streams the content directly from the URL to the SMTP server, minimizing memory usage. Ensure the URL is publicly accessible or includes necessary authentication tokens.

## Usage with Gmail

If you are using Gmail, you must use an **App Password** if you have 2-Step Verification enabled.

1. Go to your [Google Account Security](https://myaccount.google.com/security-checkup).
2. Enable 2-Step Verification.
3. Go to **App Passwords** and generate a new one.
4. Use your Gmail address as **Username** and the generated App Password as **Password**.
5. Set **SMTP Host** to `smtp.gmail.com`.
6. Set **SMTP Port** to `465` and **Use TLS/SSL** to `true` (or `587` / `false`).

## License

ISC
