# Amazon SES Adapter for ThorMail

Adapter for [ThorMail](https://thormail.io), the professional self-hosted email orchestration server.

> [!IMPORTANT]
> To use this adapter, you must have a running instance of **ThorMail** installed.
> This adapter is designed to be installed and managed directly from the ThorMail **Admin Panel**.

Allows you to send transactional and marketing emails via **Amazon Simple Email Service (SES)** using the official AWS SDK v3 (SESv2 Client).

## Installation

1. Go to your **ThorMail Admin Panel**.
2. Navigate to the **Adapters** section.
3. Click **Add New Adapter**.
4. Search for `thormail-adapter-ses` and click **Install**.

## Configuration

In your ThorMail dashboard, navigate to **Connections** and select **Amazon SES**.

### Required Fields

* **AWS Region**: The AWS region where your SES identity is verified (e.g., `us-east-1`).
* **Access Key ID**: Your AWS IAM User Access Key ID with SES permissions.
* **Secret Access Key**: Your AWS IAM User Secret Access Key.
* **From Email**: The sender address. **Must be verified** in your Amazon SES console (unless your account is out of Sandbox mode).

### Optional Fields

* **From Name**: The friendly name displayed to recipients.
* **Adapter Name**: Internal name for this adapter instance.
* **Custom Endpoint**: Optional custom endpoint URL. Leave empty to use default. Useful for AWS-compatible alternatives or testing with local development (e.g., LocalStack).

## Features

* **AWS SDK v3 (SESv2)**: Built using the latest `@aws-sdk/client-sesv2` for maximum performance and security.
* **Idempotency & Tracking**: Automatically injects `ThorMail-Idempotency-Key` tag to emails for tracking in AWS Console.
* **Smart Error Handling**: Automatically detects throttling (`ThrottlingException`, `TooManyRequestsException`) and temporarily pauses sending.
* **Secure**: Uses official AWS signature version 4 authentication.

## Getting AWS Credentials

1. Log in to your **AWS Console**.
2. Go to **IAM** > **Users** > **Create user**.
3. Name the user (e.g., `thormail-ses-user`).
4. Attach policies directly: search for and select `AmazonSESFullAccess`.
5. Create the user and copy the **Access Key ID** and **Secret Access Key**.

> [!NOTE]
> If your AWS account is in **SES Sandbox mode**, you can only send emails to verified addresses. You must request a production access limit increase to send to unverified users.

## License

ISC
