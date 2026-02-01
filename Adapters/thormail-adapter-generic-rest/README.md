# ThorMail Generic REST API Adapter

A highly configurable adapter for [ThorMail](https://thormail.io) that allows sending messages to any generic REST API.

> [!IMPORTANT]
> To use this adapter, you must have a running instance of **ThorMail** installed.
> This adapter is designed to be installed and managed directly from the ThorMail **Admin Panel**.

## Installation

1. Go to your **ThorMail Admin Panel**.
2. Navigate to the **Adapters** section.
3. Click **Add New Adapter**.
4. Search for `thormail-adapter-generic-rest` and click **Install**.

## 📖 Overview

This adapter provides a flexible bridge between ThorMail and any external service that accepts HTTP requests (POST, PUT, PATCH, GET). It is ideal for:

- Integrating with bespoke internal APIs.
- Connecting to small providers without dedicated adapters.
- Prototyping new integrations quickly.
- Webhook-based messaging.

## 🛠️ Configuration

When creating a new Connection in ThorMail, select **Generic REST API** and configure the following fields:

| Field | Type | Description |
|-------|------|-------------|
| **Base URL** | `text` | The full HTTP(S) endpoint of the external API. |
| **HTTP Method**| `select` | The method to use (POST, PUT, PATCH, GET). |
| **Custom Headers** | `customHeaders` | Headers required for authentication or metadata (e.g., `Authorization`). |
| **Payload Template** | `json-template` | A JSON template with `{{to}}`, `{{subject}}`, and `{{body}}` placeholders. |
| **Success Status Code(s)** | `text` | Comma-separated list of successful HTTP codes (default: `200,201,202`). |

### Payload Replacements

You can use the following variables in your **Payload Template**:

- `{{to}}`: The recipient's identifier (address, phone, ID).
- `{{subject}}`: The message subject or title.
- `{{body}}`: The main content of the message.
- `{{any_data_key}}`: Any key passed in the `data` object during the send request.

### Example Configuration: Simple Webhook

- **Base URL**: `https://hooks.example.com/services/T0000/B0000/XXXX`
- **Method**: `POST`
- **Payload Template**:

```json
{
  "text": "New Mail to {{to}}: {{subject}}",
  "details": "{{body}}"
}
```

### Example Configuration: authenticated API

- **Base URL**: `https://api.provider.com/v1/messages`
- **Method**: `POST`
- **Custom Headers**:
  - `X-API-Key`: `your-secret-key`
  - `Content-Type`: `application/json`
- **Payload Template**:

```json
{
  "recipient": "{{to}}",
  "title": "{{subject}}",
  "html_body": "{{body}}",
  "metadata": {
    "source": "thormail"
  }
}
```

## 🚀 Features

- **Standard Idempotency**: Automatically sends `Idempotency-Key` or `X-Idempotency-Key` headers if available.
- **Smart Retries**: Correctly identifies 429 and 5xx errors as temporary for ThorMail's retry logic.
- **Custom Success Logic**: Configurable success status codes to match legacy or non-standard APIs.
- **Dynamic Headers**: Merges headers provided in the specific send request with the global configuration.

## 📜 License

This adapter is licensed under the MIT License. See the main ThorMail repository for details.

---
*Powered by [ThorMail](https://thormail.io) - The God of Deliveries.*
