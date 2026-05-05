<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RCIC Licence Verification – WayToCanada</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 30px 0; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    .header { background: #1a56db; padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 22px; margin: 0; }
    .body { padding: 36px 40px; }
    .body p { color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .info-box { background: #f0f4ff; border-left: 4px solid #1a56db; border-radius: 4px; padding: 16px 20px; margin: 24px 0; }
    .info-box p { margin: 4px 0; font-size: 14px; }
    .btn { display: inline-block; margin: 8px 0 24px; background: #1a56db; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; }
    .footer { background: #f9fafb; padding: 20px 40px; text-align: center; }
    .footer p { color: #9ca3af; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>WayToCanada – RCIC Verification</h1>
    </div>
    <div class="body">
      <p>Hello,</p>
      <p>
        A consultant has registered on <strong>WayToCanada</strong> and claimed the following RCIC registration number.
        If you authorised this account, please click the button below to verify their licence.
      </p>

      <div class="info-box">
        <p><strong>Applicant Name:</strong> {{ $applicant->name }}</p>
        <p><strong>Applicant Email:</strong> {{ $applicant->email }}</p>
        <p><strong>RCIC Number:</strong> {{ $rcicNumber }}</p>
      </div>

      <p>Click the button below to confirm verification:</p>

      <a href="{{ $verificationUrl }}" class="btn">Verify RCIC Licence</a>

      <p style="font-size:13px; color:#6b7280;">
        This link expires in <strong>3 days</strong>. If you did not authorise this registration,
        please ignore this email — no action is required.
      </p>
    </div>
    <div class="footer">
      <p>© {{ date('Y') }} WayToCanada &nbsp;|&nbsp; This is an automated message, please do not reply.</p>
    </div>
  </div>
</body>
</html>
