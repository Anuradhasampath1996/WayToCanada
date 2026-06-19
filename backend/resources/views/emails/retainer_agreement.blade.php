<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Retainer Agreement</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 36px 40px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p  { margin: 6px 0 0; color: rgba(255,255,255,.8); font-size: 14px; }
    .body { padding: 36px 40px; }
    .body p { font-size: 15px; line-height: 1.7; margin: 0 0 16px; color: #374151; }
    .pathway-badge { display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 4px 14px; border-radius: 99px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
    .cta-wrap { text-align: center; margin: 32px 0; }
    .cta { display: inline-block; background: #059669; color: #fff !important; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: .2px; }
    .cta:hover { background: #047857; }
    .note { background: #f0fdf4; border-left: 4px solid #059669; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 24px 0; font-size: 13px; color: #065f46; }
    .footer { border-top: 1px solid #e5e7eb; padding: 24px 40px; text-align: center; }
    .footer p { margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.6; }
    .url-fallback { word-break: break-all; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>RCICMASTER</h1>
      <p>Retainer Agreement</p>
    </div>
    <div class="body">
      <p>Hello <strong>{{ $clientName }}</strong>,</p>
      <p>
        Your immigration consultant, <strong>{{ $consultantName }}</strong>, has prepared a Retainer Agreement for your immigration case.
      </p>
      @if($pathway)
      <p>Your assigned immigration pathway:</p>
      <span class="pathway-badge">{{ $pathway }}</span>
      @endif
      <p>
        Please review and digitally sign the agreement to officially begin your case. By signing, you agree to retain the services of your consultant under the terms outlined in the agreement, in compliance with RCIC (Regulated Canadian Immigration Consultant) professional standards.
      </p>
      <div class="cta-wrap">
        <a href="{{ $agreementUrl }}" class="cta">Review & Sign Agreement</a>
      </div>
      <div class="note">
        <strong>Important:</strong> This link is unique to you and allows you to sign the agreement digitally. Please do not share it.
      </div>
      <p>If the button above doesn't work, copy and paste this link into your browser:</p>
      <p class="url-fallback">{{ $agreementUrl }}</p>
    </div>
    <div class="footer">
      <p>
        This email was sent by <strong>RCICMASTER</strong> on behalf of your immigration consultant.<br />
        If you did not expect this email, please contact your consultant directly.
      </p>
    </div>
  </div>
</body>
</html>
