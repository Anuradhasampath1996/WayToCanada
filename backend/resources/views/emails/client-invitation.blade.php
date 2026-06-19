<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your RCICMASTER Portal Invitation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; margin: 0; padding: 24px; color: #18181b; }
        .card { background: #ffffff; border-radius: 12px; max-width: 560px; margin: 0 auto; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
        .logo { font-size: 22px; font-weight: 700; color: #2563eb; margin-bottom: 32px; }
        h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px; }
        p { font-size: 15px; line-height: 1.6; color: #52525b; margin: 0 0 16px; }
        .credentials { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 24px 0; }
        .credentials p { margin: 4px 0; color: #18181b; }
        .credentials .label { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #71717a; }
        .credentials .value { font-size: 16px; font-weight: 600; font-family: monospace; }
        .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px 0; }
        .footer { margin-top: 32px; font-size: 13px; color: #a1a1aa; }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">RCICMASTER</div>

        <h1>You've been invited!</h1>
        <p>Hi <strong>{{ $client->name }}</strong>,</p>
        <p>
            <strong>{{ $consultant->name }}</strong> has created a RCICMASTER client portal account for you.
            You can use the portal to track your immigration case, share documents, and stay updated on your application.
        </p>

        <div class="credentials">
            <p class="label">Your login email</p>
            <p class="value">{{ $client->email }}</p>

            <br>

            <p class="label">Temporary password</p>
            <p class="value">{{ $password }}</p>
        </div>

        <p>Please sign in and change your password as soon as possible.</p>

        <a href="{{ $loginUrl }}" class="btn">Sign in to your portal</a>

        <div class="footer">
            <p>If you did not expect this invitation, you can safely ignore this email.</p>
            <p>&copy; {{ date('Y') }} RCICMASTER. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
