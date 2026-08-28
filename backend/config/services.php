<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key'    => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'ca-central-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'google' => [
        'client_id'     => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect'      => env('GOOGLE_REDIRECT_URI', 'http://localhost:8000/api/v1/auth/google/callback'),
    ],

    'github' => [
        'client_id'     => env('GITHUB_CLIENT_ID'),
        'client_secret' => env('GITHUB_CLIENT_SECRET'),
        'redirect'      => env('GITHUB_REDIRECT_URI', 'http://localhost:8000/api/v1/auth/github/callback'),
    ],

    's3' => [
        'key'    => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'ca-central-1'),
        'bucket' => env('AWS_S3_BUCKET'),
        'url'    => env('AWS_URL'),
    ],

    'paypal' => [
        'webhook_id' => env('PAYPAL_WEBHOOK_ID'),
    ],

    /*
     | OCR / AI Service
     | -----------------
     | Point OCR_SERVICE_URL to your AI service:
     |   - Local FastAPI:   http://127.0.0.1:8001/api/v1
     |   - Google Colab:    https://<ngrok-id>.ngrok-free.app/api/v1
     |   - Any hosted API:  https://your-model.example.com/api/v1
     */
    'ocr' => [
        'url'     => env('OCR_SERVICE_URL', 'http://127.0.0.1:8001/api/v1'),
        // EasyOCR on CPU can exceed 60s (cold start + large phone photos).
        'timeout' => (int) env('OCR_SCAN_TIMEOUT', 300),
        // Prefer OpenAI Vision (same OPENAI_API_KEY as legislation) when available.
        'openai_enabled' => filter_var(env('DOCUMENT_OCR_OPENAI_ENABLED', true), FILTER_VALIDATE_BOOL),
        'openai_model'   => env('DOCUMENT_OCR_OPENAI_MODEL', env('LEGISLATION_OPENAI_MODEL', 'gpt-4o-mini')),
        'openai_timeout' => (int) env('DOCUMENT_OCR_OPENAI_TIMEOUT', 60),
    ],

    'openai' => [
        'key' => env('OPENAI_API_KEY'),
    ],

    'twilio' => [
        'sid'            => env('TWILIO_ACCOUNT_SID'),
        'token'          => env('TWILIO_AUTH_TOKEN'),
        'whatsapp_from'  => env('TWILIO_WHATSAPP_FROM'),
    ],

    'whatsapp' => [
        'provider' => env('WHATSAPP_PROVIDER', 'meta'),
    ],

    'whatsapp_cloud' => [
        'phone_number_id'       => env('WHATSAPP_CLOUD_PHONE_NUMBER_ID'),
        'waba_id'               => env('WHATSAPP_CLOUD_WABA_ID'),
        'access_token'          => env('WHATSAPP_CLOUD_ACCESS_TOKEN'),
        'api_version'           => env('WHATSAPP_CLOUD_API_VERSION', 'v21.0'),
        'language'              => env('WHATSAPP_CLOUD_LANGUAGE', 'en'),
        'consultant_template'   => env('WHATSAPP_CLOUD_CONSULTANT_TEMPLATE', 'wtc_consultant_alert'),
        'client_template'       => env('WHATSAPP_CLOUD_CLIENT_TEMPLATE', 'wtc_client_alert'),
        'webhook_verify_token'  => env('WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN'),
        'app_secret'            => env('WHATSAPP_CLOUD_APP_SECRET'),
    ],

    'google_meet' => [
        'client_id'     => env('GOOGLE_MEET_CLIENT_ID', env('GOOGLE_CLIENT_ID')),
        'client_secret' => env('GOOGLE_MEET_CLIENT_SECRET', env('GOOGLE_CLIENT_SECRET')),
        'redirect_uri'  => env('GOOGLE_MEET_REDIRECT_URI', 'http://localhost:8000/api/v1/consultant/meeting-account/oauth/google/callback'),
    ],

    'zoom' => [
        'client_id'     => env('ZOOM_CLIENT_ID'),
        'client_secret' => env('ZOOM_CLIENT_SECRET'),
        'redirect_uri'  => env('ZOOM_REDIRECT_URI', 'http://localhost:8000/api/v1/consultant/meeting-account/oauth/zoom/callback'),
    ],

    'microsoft' => [
        'client_id'     => env('MICROSOFT_CLIENT_ID'),
        'client_secret' => env('MICROSOFT_CLIENT_SECRET'),
        'redirect_uri'  => env('MICROSOFT_REDIRECT_URI', 'http://localhost:8000/api/v1/consultant/meeting-account/oauth/teams/callback'),
        'tenant'        => env('MICROSOFT_TENANT_ID', 'common'),
    ],

];
