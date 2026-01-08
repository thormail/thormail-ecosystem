# SMTP Adapter for ThorMail

Adapter for [ThorMail](https://thormail.io), the professional self-hosted email orchestration server.

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
