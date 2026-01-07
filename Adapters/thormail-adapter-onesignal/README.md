# OneSignal Adapter for ThorMail

This is an official adapter for [ThorMail](https://thormail.io), the professional self-hosted email orchestration server.

> [!IMPORTANT]
> To use this adapter, you must have a running instance of **ThorMail** installed.
> This adapter is designed to be installed and managed directly from the ThorMail **Admin Panel**.

Allows you to send transactional and marketing emails via the OneSignal API through your ThorMail infrastructure.

## Installation

1. Go to your **ThorMail Admin Panel**.
2. Navigate to the **Adapters** section.
3. Click **Add New Adapter**.
4. Search for `thormail-adapter-onesignal` and click **Install**.

## Configuration

In your ThorMail dashboard, navigate to **Connections** and select **OneSignal**.

### Required Fields

* **App ID**: Your OneSignal App ID (Settings > Keys & IDs).
* **REST API Key**: Your OneSignal REST API Key.
* **From Email**: The sender address (must be verified in OneSignal).

### Optional Fields

* **From Name**: The friendly name displayed to recipients.
* **Webhook Header Key**: The name of the custom header to check (e.g., `X-Webhook-Token`).
* **Webhook Header Value**: The secret value that the header must match.

## Features

* **Smart Rate Limiting**: Automatically detects `429` responses and pauses the worker based on provider recommendations.
* **Idempotency**: Prevents duplicate sends using ThorMail's internal key system.
* **Provider Templates**: Supports using OneSignal's native templates. To use a template:
    1. Set `_useProviderTemplate` to `true` in your message `data`.
    2. Provide the `_templateId` (OneSignal UUID) in your message `data`.

## Webhook Configuration (Event Streams)

To receive delivery and engagement events (delivered, opened, clicked, etc.) in ThorMail, you must configure **Event Streams** in your OneSignal dashboard.

1. Go to **Settings** > **Event Streams**.
2. Click **New Event Stream**.
3. Choose **Webhook** as the destination.
4. **URL**: Copy the **Webhook URL** from your adapter configuration in the ThorMail **Admin Panel** (**Adapters** > **OneSignal**).
5. **Custom Header**:
    In OneSignal, you must add a custom header that matches your ThorMail configuration:
    * Key: `YOUR_HEADER_KEY` (e.g., `X-Webhook-Token`)
    * Value: `YOUR_HEADER_VALUE`

6. **JSON Body**:
    You **MUST** use the following Custom JSON structure. Copy and paste this exactly into the "Custom Body" section:

    ```json
    {
      "event": {
        "kind": "{{ event.kind }}",
        "id": "{{ event.id }}",
        "timestamp": "{{ event.timestamp }}",
        "external_id": "{{ event.external_id }}"
      },
      "message": {
        "id": "{{ message.id }}",
        "name": "{{ message.name }}"
      }
    }
    ```
