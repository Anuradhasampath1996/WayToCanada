<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Agreement Signed</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); padding: 36px 40px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 22px; font-weight: 700; }
    .header p  { margin: 6px 0 0; color: rgba(255,255,255,.85); font-size: 14px; }
    .body { padding: 36px 40px; }
    .body p { font-size: 15px; line-height: 1.7; margin: 0 0 16px; color: #374151; }
    .cta-wrap { text-align: center; margin: 28px 0; }
    .cta { display: inline-block; background: #1d4ed8; color: #fff !important; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; }
    .meta { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 18px; border-radius: 0 8px 8px 0; font-size: 13px; color: #1e3a8a; }
    .footer { border-top: 1px solid #e5e7eb; padding: 24px 40px; text-align: center; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Agreement Signed</h1>
      <p>Way To Canada — Consultant Notification</p>
    </div>
    <div class="body">
      <p>Hello <strong>{{ $consultantName }}</strong>,</p>
      <p>
        <strong>{{ $clientName }}</strong> has signed the retainer agreement
        @if($signedVia === 'uploaded_pdf') by uploading a signed PDF @else with a digital signature @endif.
      </p>
      @if($pathway)
      <p>Pathway: <strong>{{ $pathway }}</strong></p>
      @endif
      <div class="meta">
        Signed at: <strong>{{ $signedAt ?? 'Just now' }}</strong><br />
        Application forms are now unlocked for your client in their portal.
      </div>
      <div class="cta-wrap">
        <a href="{{ $workspaceUrl }}" class="cta">Open Case Workspace</a>
      </div>
    </div>
    <div class="footer">
      <p>Way To Canada — automated consultant notification</p>
    </div>
  </div>
</body>
</html>
