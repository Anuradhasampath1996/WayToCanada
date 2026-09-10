<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$b = app(App\Services\Email\EmailBrandingService::class);
$platform = $b->forPlatform('Anuradha');

$html1 = view('emails.generic_notification', array_merge($platform, [
    'emailSubject' => 'Legislation updated: I-2.5',
    'notification' => new App\Models\UserNotification([
        'title' => 'Legislation updated: I-2.5',
        'body' => 'Immigration and Refugee Protection Act was changed. Re-run Sync + Linkify.',
        'action_url' => 'https://admin.rcicmaster.ca',
        'type' => 'system_alert',
    ]),
    'categoryLabel' => 'SYSTEM',
    'actionLabel' => 'Open dashboard',
]))->render();

$c = new App\Models\User([
    'name' => 'Jane RCIC',
    'company_name' => 'Chen Immigration',
    'company_phone' => '+1 416 555 0100',
    'company_website' => 'https://chen.ca',
    'email' => 'jane@chen.ca',
]);
$clientBrand = $b->forConsultant($c, 'Alex');

$html2 = view('emails.retainer_agreement', array_merge($clientBrand, [
    'consultantName' => 'Jane RCIC',
    'pathway' => 'Express Entry',
    'agreementUrl' => 'https://example.com/sign',
]))->render();

$html3 = view('emails.auth.verify-email', array_merge($platform, [
    'actionUrl' => 'https://example.com/verify',
]))->render();

echo 'platform_ok='.(str_contains($html1, 'D01D20') && (str_contains($html1, 'data:image/png;base64,') || str_contains($html1, 'rcicmaster-logo')) ? 'yes' : 'no').PHP_EOL;
echo 'client_ok='.(str_contains($html2, 'Chen Immigration') && str_contains($html2, 'Powered by RCICMASTER') ? 'yes' : 'no').PHP_EOL;
echo 'verify_ok='.(str_contains($html3, 'Verify Email Address') && str_contains($html3, 'D01D20') ? 'yes' : 'no').PHP_EOL;

$renderer = app(App\Services\Email\EmailTemplateRenderer::class);
echo 'preview_admin='.strlen($renderer->renderPreview('notification.system_alert.admin')).PHP_EOL;
echo 'preview_client='.strlen($renderer->renderPreview('transactional.retainer_agreement')).PHP_EOL;
