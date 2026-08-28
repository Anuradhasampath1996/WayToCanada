<?php

use App\Http\Controllers\WhatsAppWebhookController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\ConsultantRegisterController;
use App\Http\Controllers\Auth\ConsultantOnboardingController;
use App\Http\Controllers\Auth\PublicRegisterController;
use App\Http\Controllers\Admin\AdminGstHstController;
use App\Http\Controllers\Admin\AdminCrsController;
use App\Http\Controllers\Admin\AdminLegislationController;
use App\Http\Controllers\LegislationController;
use App\Http\Controllers\Admin\AdminApplicationPackageController;
use App\Http\Controllers\Admin\AdminIrccInteractiveFormController;
use App\Http\Controllers\Admin\AdminWhatsAppInboxController;
use App\Http\Controllers\Admin\AdminStatsController;
use App\Http\Controllers\Admin\AdminUsersController;
use App\Http\Controllers\Admin\AdminRcicController;
use App\Http\Controllers\Admin\AdminImmigrationConsultantController;
use App\Http\Controllers\Admin\AdminPaymentGatewayController;
use App\Http\Controllers\Admin\AdminStripeTestController;
use App\Http\Controllers\Admin\AdminSubscriptionPackageController;
use App\Http\Controllers\Admin\AdminMarketingOrdersController;
use App\Http\Controllers\Admin\AdminClientPaymentRequestsController;
use App\Http\Controllers\Admin\AdminStorageSubscriptionsController;
use App\Http\Controllers\Admin\AdminSubscriptionPaymentsController;
use App\Http\Controllers\Admin\AdminPlatformCompanyController;
use App\Http\Controllers\Admin\AdminLmsController;
use App\Http\Controllers\Consultant\ConsultantLmsController;
use App\Http\Controllers\Consultant\ConsultantPaymentAccountController;
use App\Http\Controllers\Consultant\ConsultantClientPaymentRequestController;
use App\Http\Controllers\Consultant\ConsultantMeetingAccountController;
use App\Http\Controllers\Consultant\ConsultantMeetingOAuthController;
use App\Http\Controllers\Consultant\ConsultantCalendarController;
use App\Http\Controllers\Consultant\ConsultantClientMeetingController;
use App\Http\Controllers\Consultant\ConsultantLettersController;
use App\Http\Controllers\Consultant\ConsultantWorkspaceAiAdvisorController;
use App\Http\Controllers\Consultant\ConsultantLegislationController;
use App\Http\Controllers\Consultant\ConsultantRcicCommunityController;
use App\Http\Controllers\Consultant\ConsultantSupportTicketController;
use App\Http\Controllers\Consultant\ConsultantClientRequestController;
use App\Http\Controllers\Client\ClientConsultantRequestController;
use App\Http\Controllers\Consultant\ConsultantClientActivityController;
use App\Http\Controllers\Consultant\ConsultantClientComplianceController;
use App\Http\Controllers\Consultant\ConsultantClientTrustController;
use App\Http\Controllers\Client\ClientMeetingController;
use App\Http\Controllers\Client\ClientPaymentRequestController;
use App\Http\Controllers\Client\ClientTrustController;
use App\Http\Controllers\Client\ClientLmsController;
use App\Http\Controllers\PublicPaymentRequestController;
use App\Http\Controllers\PublicClientMeetingController;
use App\Http\Controllers\ApplicationPackageController;
use App\Http\Controllers\SecurePdfController;
use App\Http\Controllers\AgreementTemplateController;
use App\Http\Controllers\CaseFileController;
use App\Http\Controllers\CaseManagementHubController;
use App\Http\Controllers\CaseMessagingController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\ClientIrccInteractiveFormController;
use App\Http\Controllers\ConsultantIrccInteractiveFormController;
use App\Http\Controllers\ConsultantProfileController;
use App\Http\Controllers\ConsultantSubscriptionController;
use App\Http\Controllers\Consultant\ConsultantBillingController;
use App\Http\Controllers\GstHstController;
use App\Http\Controllers\CrsController;
use App\Http\Controllers\DocumentOcrController;
use App\Http\Controllers\NocLookupController;
use App\Http\Controllers\DocumentSubmissionController;
use App\Http\Controllers\FileUploadController;
use App\Http\Controllers\PackageDocumentSubmissionController;
use App\Http\Controllers\IrccFormController;
use App\Http\Controllers\IrccNewsController;
use App\Http\Controllers\StripePaymentController;
use App\Http\Controllers\ConsultantStorageController;
use App\Http\Controllers\ConsultantStoragePaymentController;
use App\Http\Controllers\ConsultantWebsiteFeatureController;
use App\Http\Controllers\Admin\AdminStorageAddonPackageController;
use App\Http\Controllers\Admin\AdminMarketingServiceController;
use App\Http\Controllers\Admin\AdminConsultantWebsiteFeatureController;
use App\Http\Controllers\ConsultantMarketingPaymentController;
use App\Http\Controllers\StripeWebhookController;
use App\Http\Controllers\QuestionnaireController;
use App\Http\Controllers\QuestionnaireReviewController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\NotificationPreferenceController;
use App\Http\Controllers\Admin\AdminRcicCommunityController;
use App\Http\Controllers\Admin\AdminSupportTicketController;
use App\Http\Controllers\Admin\AdminBroadcastController;
use App\Http\Controllers\Admin\AdminEmailTemplateController;
use App\Http\Controllers\Admin\AdminIntegrationSettingsController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — RCICMASTER v1
|--------------------------------------------------------------------------
| All routes are prefixed with /api/v1 (set in bootstrap/app.php).
| Protected routes require a valid Sanctum token via the 'auth:sanctum' middleware.
|--------------------------------------------------------------------------
*/

// ── Public: active subscription packages (for consultant subscription gate) ──
Route::get('subscription-packages', [AdminSubscriptionPackageController::class, 'publicIndex'])
    ->name('subscription-packages.public');

Route::get('storage-addon-packages', [AdminStorageAddonPackageController::class, 'publicIndex'])
    ->name('storage-addon-packages.public');

Route::get('marketing-services', [AdminMarketingServiceController::class, 'publicIndex'])
    ->name('marketing-services.public');
Route::get('marketing-services/{slug}', [AdminMarketingServiceController::class, 'publicShow'])
    ->name('marketing-services.show');

Route::get('consultant-website/features', [ConsultantWebsiteFeatureController::class, 'index'])
    ->name('consultant-website.features');

// ── Public: IRCC news feed (no auth required — consultants & guests) ──────────
Route::get('ircc-news', [IrccNewsController::class, 'index'])->name('ircc-news.index');

// ── Public: IRCC Application Forms & Guides tree (no auth required) ──────────
Route::get('ircc-forms/tree', [IrccFormController::class, 'tree'])->name('ircc-forms.tree');

// ── Public: GST/HST sales tax rates for payments (CRA place-of-supply) ───────
Route::prefix('tax')->name('tax.')->group(function () {
    Route::get('gst-hst/rates',      [GstHstController::class, 'rates'])->name('gst-hst.rates');
    Route::post('gst-hst/calculate', [GstHstController::class, 'calculate'])->name('gst-hst.calculate');
});

// ── Public: CRS scoring rules & Express Entry draws (auto-updated) ───────────
Route::prefix('crs')->name('crs.')->group(function () {
    Route::get('rules',  [CrsController::class, 'rules'])->name('rules');
    Route::post('calculate', [CrsController::class, 'calculate'])->name('calculate');
    Route::get('draws',  [CrsController::class, 'draws'])->name('draws');
});

// ── Public: Client payment requests (token-secured, no auth) ─────────────────
Route::prefix('payment-request')->middleware('throttle:30,1')->name('payment-request.public.')->group(function () {
    Route::get('{token}',                [PublicPaymentRequestController::class, 'show'])->name('show');
    Route::post('{token}/checkout',      [PublicPaymentRequestController::class, 'checkout'])->middleware('throttle:10,1')->name('checkout');
    Route::post('{token}/confirm-sent', [PublicPaymentRequestController::class, 'confirmSent'])->middleware('throttle:10,1')->name('confirm-sent');
    Route::post('{token}/verify',        [PublicPaymentRequestController::class, 'verify'])->middleware('throttle:10,1')->name('verify');
});

// ── Public: Client meetings (token-secured, no auth) ───────────────────────────
Route::get('meeting/{token}', [PublicClientMeetingController::class, 'show'])->name('meeting.public.show');

// ── Consultant meeting OAuth callbacks (public — state-validated) ───────────────
Route::get('consultant/meeting-account/oauth/{provider}/callback', [ConsultantMeetingOAuthController::class, 'callback'])
    ->where('provider', 'google|zoom|teams')
    ->name('consultant.meeting-account.oauth.callback');

// ── Public: Case File — agreement (token-secured, no auth) ───────────────────
Route::prefix('case-file')->name('case-file.public.')->group(function () {
    Route::get('agreement/{token}',            [CaseFileController::class, 'getAgreement'])->name('agreement.get');
    Route::get('agreement/{token}/pdf',         [CaseFileController::class, 'downloadAgreementPdfPublic'])->name('agreement.pdf');
    Route::post('agreement/{token}/sign',      [CaseFileController::class, 'signAgreement'])->name('agreement.sign');
    Route::post('agreement/{token}/upload-doc',[CaseFileController::class, 'uploadSignedDoc'])->name('agreement.upload-doc');
});

// ── Public: Stripe webhook (no auth — verified via Stripe signature) ────────────
Route::post('webhooks/stripe', [StripeWebhookController::class, 'handle'])
    ->name('webhooks.stripe');

// ── Public: Meta WhatsApp webhook (no auth — verified via verify token + signature) ─
Route::get('webhooks/whatsapp', [WhatsAppWebhookController::class, 'verify'])
    ->name('webhooks.whatsapp.verify');
Route::post('webhooks/whatsapp', [WhatsAppWebhookController::class, 'handle'])
    ->name('webhooks.whatsapp.handle');

// ── Authentication (Google OAuth + email/password) ───────────────────────────
Route::prefix('auth')->group(function () {
    Route::get('google/redirect',              [AuthController::class, 'redirectToGoogle'])->name('auth.google.redirect');
    Route::get('google/mobile/redirect',       [AuthController::class, 'redirectToGoogleMobile'])->name('auth.google.mobile.redirect');
    Route::get('google/mobile/start',          [AuthController::class, 'redirectToGoogleMobileStart'])->name('auth.google.mobile.start');
    Route::get('google/callback',              [AuthController::class, 'handleGoogleCallback'])->name('auth.google.callback');
    Route::get('google/consultant/redirect',   [ConsultantRegisterController::class, 'googleRedirect'])->name('auth.google.consultant.redirect');
    Route::get('google/consultant/login',      [AuthController::class, 'redirectToGoogleConsultantLogin'])->name('auth.google.consultant.login');
    Route::get('github/redirect',              [AuthController::class, 'redirectToGithubPublic'])->name('auth.github.redirect');
    Route::get('github/consultant/login',      [AuthController::class, 'redirectToGithubConsultantLogin'])->name('auth.github.consultant.login');
    Route::get('github/callback',              [AuthController::class, 'handleGithubCallback'])->name('auth.github.callback');
    Route::post('login',                       [AuthController::class, 'login'])->name('auth.login');
    Route::post('forgot-password',             [AuthController::class, 'forgotPassword'])->name('auth.forgot-password');
    Route::post('reset-password',              [AuthController::class, 'resetPassword'])->name('auth.reset-password');
    Route::post('set-password',                [AuthController::class, 'setPassword'])
        ->middleware('auth:sanctum')
        ->name('auth.set-password');

    // Public (client) registration
    Route::post('register',                    [PublicRegisterController::class, 'register'])->name('auth.register');
    Route::get('public/email/verify/{id}/{hash}', [PublicRegisterController::class, 'verifyEmail'])
        ->middleware('signed')
        ->name('public.verification.verify');

    // Consultant registration
    Route::post('register/consultant',         [ConsultantRegisterController::class, 'register'])->name('auth.register.consultant');
    Route::get('google/consultant/redirect',   [ConsultantRegisterController::class, 'googleRedirect'])->name('auth.google.consultant.redirect');

    // Email verification (signed URL, no auth required — link is clicked from inbox)
    Route::get('email/verify/{id}/{hash}',     [ConsultantRegisterController::class, 'verifyEmail'])
        ->middleware('signed')
        ->name('verification.verify');

    // Resend verification (requires auth token)
    Route::post('email/resend',                [ConsultantRegisterController::class, 'resendVerification'])
        ->middleware(['auth:sanctum', 'throttle:6,1'])
        ->name('verification.send');

    // RCIC licence verification (signed URL, no auth required — clicked from CICC email)
    Route::get('consultant/license/verify/{id}', [ConsultantOnboardingController::class, 'verify'])
        ->middleware('signed')
        ->name('consultant.license.verify');
});

// ── Document / file uploads ───────────────────────────────────────────────────
// Protected: requires a valid Sanctum token.
Route::middleware('auth:sanctum')->prefix('documents')->name('documents.')->group(function () {
    Route::post('upload', [FileUploadController::class, 'store'])->name('upload');
    // OCR proxy — forwards uploaded image/PDF to the AI service and returns extracted data
    Route::post('scan',   [DocumentOcrController::class, 'scan'])->name('scan');
});

Route::middleware(['auth:sanctum', 'throttle:20,1'])->prefix('noc')->name('noc.')->group(function () {
    Route::post('suggest', [NocLookupController::class, 'suggest'])->name('suggest');
});

// ── Protected routes ─────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {
    Route::get('me',      [AuthController::class, 'me'])->name('auth.me');
    Route::post('logout', [AuthController::class, 'logout'])->name('auth.logout');

    // ── In-app notifications (all authenticated users) ────────────────────────
    Route::prefix('notifications')->name('notifications.')->group(function () {
        Route::get('/',                    [NotificationController::class, 'index'])->name('index');
        Route::get('unread-count',         [NotificationController::class, 'unreadCount'])->name('unread-count');
        Route::post('read-all',            [NotificationController::class, 'markAllRead'])->name('read-all');
        Route::post('{notification}/read', [NotificationController::class, 'markRead'])->name('read');
    });
    Route::get('notification-preferences',  [NotificationPreferenceController::class, 'show'])->name('notification-preferences.show');
    Route::put('notification-preferences',  [NotificationPreferenceController::class, 'update'])->name('notification-preferences.update');

    Route::post('crs/sync', [CrsController::class, 'sync'])->name('crs.sync');

    // ── Consultant profile ────────────────────────────────────────────────────
    Route::get('consultant/profile',        [ConsultantProfileController::class, 'show'])->name('consultant.profile.show');
    Route::put('consultant/profile',        [ConsultantProfileController::class, 'update'])->name('consultant.profile.update');
    Route::post('consultant/profile/logo',      [ConsultantProfileController::class, 'uploadLogo'])->name('consultant.profile.logo');
    Route::post('consultant/profile/avatar',    [ConsultantProfileController::class, 'uploadAvatar'])->name('consultant.profile.avatar');
    Route::delete('consultant/profile/avatar',  [ConsultantProfileController::class, 'deleteAvatar'])->name('consultant.profile.avatar.delete');
    Route::post('consultant/profile/signature', [ConsultantProfileController::class, 'saveSignature'])->name('consultant.profile.signature');

    // ── Consultant: client payment collection (Stripe Connect / PayPal / Interac) ─
    Route::prefix('consultant/payment-account')->name('consultant.payment-account.')->group(function () {
        Route::get('/',                    [ConsultantPaymentAccountController::class, 'show'])->name('show');
        Route::put('/',                    [ConsultantPaymentAccountController::class, 'update'])->name('update');
        Route::post('stripe/connect',     [ConsultantPaymentAccountController::class, 'stripeConnect'])->name('stripe.connect');
        Route::post('stripe/sync',         [ConsultantPaymentAccountController::class, 'stripeSync'])->name('stripe.sync');
        Route::post('stripe/dashboard',    [ConsultantPaymentAccountController::class, 'stripeDashboard'])->name('stripe.dashboard');
    });

    Route::prefix('consultant/meeting-account')->name('consultant.meeting-account.')->group(function () {
        Route::get('/',  [ConsultantMeetingAccountController::class, 'show'])->name('show');
        Route::put('/',  [ConsultantMeetingAccountController::class, 'update'])->name('update');
        Route::post('{provider}/connect',    [ConsultantMeetingOAuthController::class, 'connect'])->where('provider', 'google|zoom|teams');
        Route::post('{provider}/disconnect', [ConsultantMeetingOAuthController::class, 'disconnect'])->where('provider', 'google|zoom|teams');
    });
    Route::get('consultant/rcic-registry',      [ConsultantProfileController::class, 'rcicRegistry'])->name('consultant.rcic-registry');
    Route::get('consultant/calendar',           [ConsultantCalendarController::class, 'index'])->name('consultant.calendar');

    // ── Consultant agreement template library ─────────────────────────────────
    Route::prefix('consultant/agreement-templates')->name('consultant.agreement-templates.')->group(function () {
        Route::get('/',                    [AgreementTemplateController::class, 'index'])->name('index');
        Route::post('/',                   [AgreementTemplateController::class, 'store'])->name('store');
        Route::put('{template}',           [AgreementTemplateController::class, 'update'])->name('update');
        Route::delete('{template}',        [AgreementTemplateController::class, 'destroy'])->name('destroy');
    });

    // ── Consultant letters (AI drafting + templates) ───────────────────────────
    Route::prefix('consultant/letters')->name('consultant.letters.')->group(function () {
        Route::get('meta',                          [ConsultantLettersController::class, 'meta'])->name('meta');
        Route::get('context/{profile}',               [ConsultantLettersController::class, 'clientContext'])->name('context');
        Route::get('templates',                       [ConsultantLettersController::class, 'templatesIndex'])->name('templates.index');
        Route::post('templates',                      [ConsultantLettersController::class, 'templatesStore'])->name('templates.store');
        Route::put('templates/{template}',            [ConsultantLettersController::class, 'templatesUpdate'])->name('templates.update');
        Route::delete('templates/{template}',         [ConsultantLettersController::class, 'templatesDestroy'])->name('templates.destroy');
        Route::post('generate',                       [ConsultantLettersController::class, 'generate'])->name('generate');
        Route::get('/',                               [ConsultantLettersController::class, 'index'])->name('index');
        Route::post('/',                              [ConsultantLettersController::class, 'store'])->name('store');
        Route::get('{letter}',                        [ConsultantLettersController::class, 'show'])->name('show');
        Route::put('{letter}',                        [ConsultantLettersController::class, 'update'])->name('update');
        Route::delete('{letter}',                       [ConsultantLettersController::class, 'destroy'])->name('destroy');
        Route::post('{letter}/export-pdf',            [ConsultantLettersController::class, 'exportPdf'])->name('export-pdf');
        Route::post('{letter}/save-as-template',      [ConsultantLettersController::class, 'saveAsTemplate'])->name('save-as-template');
    });

    // ── Consultant RCIC onboarding ────────────────────────────────────────────
    Route::post('consultant/onboarding', [ConsultantOnboardingController::class, 'submit'])
        ->name('consultant.onboarding');

    // ── Consultant subscription ───────────────────────────────────────────────
    Route::get('consultant/subscription',              [ConsultantSubscriptionController::class, 'status'])->name('consultant.subscription.status');
    Route::post('consultant/subscription/start-trial', [ConsultantSubscriptionController::class, 'startTrial'])->name('consultant.subscription.start-trial');
    Route::post('consultant/subscription/subscribe',   [ConsultantSubscriptionController::class, 'subscribe'])->name('consultant.subscription.subscribe');

    Route::prefix('consultant/billing')->middleware('role:rcic,super-admin,admin')->name('consultant.billing.')->group(function () {
        Route::get('/',           [ConsultantBillingController::class, 'show'])->name('show');
        Route::get('invoices',    [ConsultantBillingController::class, 'invoices'])->name('invoices');
        Route::get('payments/{subscriptionPaymentRecord}', [ConsultantBillingController::class, 'showPayment'])->name('payments.show');
        Route::get('payments/{subscriptionPaymentRecord}/invoice', [ConsultantBillingController::class, 'downloadInvoice'])->name('payments.invoice');
        Route::post('cancel',     [ConsultantBillingController::class, 'cancel'])->name('cancel');
        Route::post('auto-renew', [ConsultantBillingController::class, 'updateAutoRenew'])->name('auto-renew');
        Route::post('marketing/{order}/cancel', [ConsultantBillingController::class, 'cancelMarketingOrder'])->name('marketing.cancel');
        Route::post('marketing/{order}/auto-renew', [ConsultantBillingController::class, 'updateMarketingAutoRenew'])->name('marketing.auto-renew');
    });

    // ── Consultant Stripe payment ─────────────────────────────────────────────
    Route::prefix('consultant/payment/stripe')->middleware('role:rcic,super-admin,admin')->name('consultant.payment.stripe.')->group(function () {
        Route::get('config',              [StripePaymentController::class, 'config'])->name('config');
        Route::get('tax-quote',           [StripePaymentController::class, 'taxQuote'])->name('tax-quote');
        Route::post('checkout-session',   [StripePaymentController::class, 'createCheckoutSession'])->name('checkout-session');
        Route::post('verify-session',     [StripePaymentController::class, 'verifySession'])->name('verify-session');
    });

    // ── Consultant personal document storage ─────────────────────────────────
    Route::prefix('consultant/storage')->name('consultant.storage.')->group(function () {
        Route::get('/',                              [ConsultantStorageController::class, 'summary'])->name('summary');
        Route::get('browse',                         [ConsultantStorageController::class, 'browse'])->name('browse');
        Route::post('folders',                       [ConsultantStorageController::class, 'createFolder'])->name('folders.store');
        Route::patch('folders/{folder}',             [ConsultantStorageController::class, 'renameFolder'])->name('folders.update');
        Route::delete('folders/{folder}',            [ConsultantStorageController::class, 'deleteFolder'])->name('folders.destroy');
        Route::post('files',                         [ConsultantStorageController::class, 'uploadFile'])->name('files.store');
        Route::get('files/{file}/view',              [ConsultantStorageController::class, 'viewFile'])->name('files.view');
        Route::get('files/{file}/download',          [ConsultantStorageController::class, 'downloadFile'])->name('files.download');
        Route::patch('files/{file}',                 [ConsultantStorageController::class, 'renameFile'])->name('files.update');
        Route::delete('files/{file}',                [ConsultantStorageController::class, 'deleteFile'])->name('files.destroy');
        Route::prefix('payment')->middleware('role:rcic,super-admin,admin')->name('payment.')->group(function () {
            Route::get('tax-quote',                  [ConsultantStoragePaymentController::class, 'taxQuote'])->name('tax-quote');
            Route::post('checkout-session',           [ConsultantStoragePaymentController::class, 'createCheckoutSession'])->name('checkout-session');
            Route::post('verify-session',             [ConsultantStoragePaymentController::class, 'verifySession'])->name('verify-session');
        });
    });

    // ── Marketing services (consultant purchases) ───────────────────────────
    Route::prefix('consultant/marketing')->name('consultant.marketing.')->group(function () {
        Route::get('orders', [ConsultantMarketingPaymentController::class, 'myOrders'])->name('orders');
        Route::prefix('payment')->middleware('role:rcic,super-admin,admin')->name('payment.')->group(function () {
            Route::get('tax-quote',        [ConsultantMarketingPaymentController::class, 'taxQuote'])->name('tax-quote');
            Route::post('checkout-session', [ConsultantMarketingPaymentController::class, 'createCheckoutSession'])->name('checkout-session');
            Route::post('verify-session',   [ConsultantMarketingPaymentController::class, 'verifySession'])->name('verify-session');
        });
    });

    // ── Client: own journey dashboard ─────────────────────────────────────────
    Route::get('client/dashboard', [CaseFileController::class, 'clientDashboard'])->name('client.dashboard');
    Route::get('client/available-consultants', [ClientConsultantRequestController::class, 'availableConsultants'])->name('client.available-consultants');
    Route::get('client/consultant-request', [ClientConsultantRequestController::class, 'current'])->name('client.consultant-request.current');
    Route::post('client/consultant-request', [ClientConsultantRequestController::class, 'store'])->name('client.consultant-request.store');
    Route::post('client/consultant-request/{consultantClientRequest}/cancel', [ClientConsultantRequestController::class, 'cancel'])->name('client.consultant-request.cancel');
    Route::get('client/payment-requests', [ClientPaymentRequestController::class, 'index'])->name('client.payment-requests.index');
    Route::get('client/meetings', [ClientMeetingController::class, 'index'])->name('client.meetings.index');
    Route::get('client/trust', [ClientTrustController::class, 'show'])->name('client.trust.show');
    Route::post('client/trust/invoices/{invoice}/approve', [ClientTrustController::class, 'approveInvoice'])->name('client.trust.invoices.approve');
    Route::get('client/case-management-hub', [CaseManagementHubController::class, 'clientShow'])->name('client.case-management-hub');
    Route::get('client/package-documents/{document}/stream', [SecurePdfController::class, 'clientPackageDocument'])->name('client.package-documents.stream');
    Route::get('client/package-documents/{document}/submission/stream', [SecurePdfController::class, 'clientPackageDocumentSubmission'])->name('client.package-documents.submission.stream');
    Route::post('client/package-documents/{document}/submit', [PackageDocumentSubmissionController::class, 'clientSubmit'])->name('client.package-documents.submit');
    Route::get('client/application-package', [ApplicationPackageController::class, 'clientShow'])->name('client.application-package');

    Route::prefix('client/interactive-forms')->name('client.interactive-forms.')->group(function () {
        Route::get('/', [ClientIrccInteractiveFormController::class, 'index'])->name('index');
        Route::get('{form}', [ClientIrccInteractiveFormController::class, 'show'])->name('show');
        Route::put('{form}', [ClientIrccInteractiveFormController::class, 'upsert'])->name('upsert');
        Route::post('{form}/submit', [ClientIrccInteractiveFormController::class, 'submit'])->name('submit');
    });

    // ── Client: LMS learning portal ─────────────────────────────────────────────
    Route::prefix('client/lms')->name('client.lms.')->group(function () {
        Route::get('courses', [ClientLmsController::class, 'myCourses'])->name('courses');
        Route::get('assignments/{assignment}', [ClientLmsController::class, 'showAssignment'])->name('assignments.show');
        Route::post('assignments/{assignment}/lessons/{lesson}/complete', [ClientLmsController::class, 'completeLesson'])->name('lessons.complete');
        Route::get('assignments/{assignment}/quizzes/{quiz}', [ClientLmsController::class, 'showQuiz'])->name('quizzes.show');
        Route::post('assignments/{assignment}/quizzes/{quiz}/submit', [ClientLmsController::class, 'submitQuiz'])->name('quizzes.submit');
        Route::get('assignments/{assignment}/exam-attempts/{attempt}', [ClientLmsController::class, 'showExamAttempt'])->name('exam-attempts.show');
        Route::post('assignments/{assignment}/homework/{homework}/submit', [ClientLmsController::class, 'submitHomework'])->name('homework.submit');
    });

    // ── Client: Document uploads ───────────────────────────────────────────────
    Route::prefix('client')->name('client.')->group(function () {
        Route::get('documents',        [DocumentSubmissionController::class, 'clientIndex'])->name('documents.index');
        Route::get('documents/{submission}/stream', [SecurePdfController::class, 'clientSubmission'])->name('documents.stream');
        Route::post('documents/upload',[DocumentSubmissionController::class, 'clientUpload'])->name('documents.upload');
        Route::get('messages',         [CaseMessagingController::class, 'clientIndex'])->name('messages.index');
        Route::get('messages/unread-count', [CaseMessagingController::class, 'clientUnreadCount'])->name('messages.unread-count');
        Route::post('messages',        [CaseMessagingController::class, 'clientSend'])->name('messages.send');
        Route::patch('messages/mark-read', [CaseMessagingController::class, 'clientMarkRead'])->name('messages.mark-read');
    });

    // ── Client: Immigration Questionnaire (autosave + submit) ─────────────────
    Route::prefix('questionnaire')->name('questionnaire.')->group(function () {
        Route::get('/',                         [QuestionnaireController::class, 'show'])->name('show');
        Route::get('/document/stream',          [QuestionnaireController::class, 'streamDocument'])->name('document-stream');
        Route::put('/',                         [QuestionnaireController::class, 'upsert'])->name('upsert');
        Route::post('/submit',                  [QuestionnaireController::class, 'submit'])->name('submit');
    });

    // ── Consultant: Legislation Hub ───────────────────────────────────────────
    Route::prefix('legislation')->name('legislation.')->group(function () {
        Route::get('hub', [LegislationController::class, 'hub'])->name('hub');
        Route::get('documents', [LegislationController::class, 'documents'])->name('documents');
        Route::get('search', [LegislationController::class, 'search'])->name('search');
        Route::get('capabilities', [LegislationController::class, 'capabilities'])->name('capabilities');
        Route::get('documents/{document}', [LegislationController::class, 'show'])->name('documents.show');
        Route::get('documents/{document}/download', [LegislationController::class, 'download'])->name('documents.download');
        Route::get('resolve', [LegislationController::class, 'resolve'])->name('resolve');
        Route::post('explain', [LegislationController::class, 'explain'])->name('explain');
    });

    Route::prefix('consultant/legislation')->name('consultant.legislation.')->group(function () {
        Route::get('bookmarks', [ConsultantLegislationController::class, 'bookmarksIndex'])->name('bookmarks.index');
        Route::post('bookmarks', [ConsultantLegislationController::class, 'bookmarksStore'])->name('bookmarks.store');
        Route::delete('bookmarks/{bookmark}', [ConsultantLegislationController::class, 'bookmarksDestroy'])->name('bookmarks.destroy');
    });

    // ── Consultant: Case Pipeline (Kanban — all signed clients) ──────────────
    Route::get('consultant/case-pipeline', [DocumentSubmissionController::class, 'pipeline'])->name('consultant.case-pipeline');

    // ── Consultant: Incoming client requests (public site self-registration) ───
    Route::prefix('consultant/client-requests')->name('consultant.client-requests.')->group(function () {
        Route::get('pending-count', [ConsultantClientRequestController::class, 'pendingCount'])->name('pending-count');
        Route::get('/', [ConsultantClientRequestController::class, 'index'])->name('index');
        Route::post('{consultantClientRequest}/accept', [ConsultantClientRequestController::class, 'accept'])->name('accept');
        Route::post('{consultantClientRequest}/decline', [ConsultantClientRequestController::class, 'decline'])->name('decline');
    });

    // ── Consultant: Client Management ─────────────────────────────────────────
    Route::prefix('consultant/clients')->name('consultant.clients.')->group(function () {        Route::get('/',                              [ClientController::class, 'index'])->name('index');
        Route::post('/',                             [ClientController::class, 'store'])->name('store');
        Route::get('{profile}',                      [ClientController::class, 'show'])->name('show');
        Route::put('{profile}',                      [ClientController::class, 'update'])->name('update');
        Route::delete('{profile}',                   [ClientController::class, 'destroy'])->name('destroy');
        Route::post('{profile}/resend-invite',        [ClientController::class, 'resendInvite'])->name('resend-invite');
        Route::patch('{profile}/toggle-status',         [ClientController::class, 'toggleStatus'])->name('toggle-status');
        Route::get('{profile}/command-center',        [ClientController::class, 'commandCenter'])->name('command-center');

        // ── Case File / Workspace ──────────────────────────────────────────────
        Route::get('{profile}/case-file',                          [CaseFileController::class, 'show'])->name('case-file.show');
        Route::patch('{profile}/case-file/lifecycle',              [CaseFileController::class, 'updateLifecycle'])->name('case-file.lifecycle');
        Route::post('{profile}/case-file/open-new',               [CaseFileController::class, 'openNewCase'])->name('case-file.open-new');
        Route::patch('{profile}/case-file/switch',                [CaseFileController::class, 'switchActiveCase'])->name('case-file.switch');
        Route::get('{profile}/case-management-hub',               [CaseManagementHubController::class, 'consultantShow'])->name('case-management-hub');
        Route::get('{profile}/package-documents/{document}/stream', [SecurePdfController::class, 'consultantPackageDocument'])->name('package-documents.stream');
        Route::patch('{profile}/case-file/select-pathway',         [CaseFileController::class, 'selectPathway'])->name('case-file.select-pathway');
        Route::patch('{profile}/case-file/pathway-assessment',   [CaseFileController::class, 'savePathwayAssessment'])->name('case-file.pathway-assessment');
        Route::patch('{profile}/case-file/assign-application-package', [CaseFileController::class, 'assignApplicationPackage'])->name('case-file.assign-application-package');
        Route::post('{profile}/case-file/send-agreement',          [CaseFileController::class, 'sendAgreement'])->name('case-file.send-agreement');
        Route::post('{profile}/case-file/send-agreement-reminder', [CaseFileController::class, 'sendAgreementReminder'])->name('case-file.send-agreement-reminder');
        Route::get('{profile}/case-file/agreement-pdf',            [CaseFileController::class, 'downloadAgreementPdf'])->name('case-file.agreement-pdf');
        Route::patch('{profile}/case-file/agreement-milestones',  [CaseFileController::class, 'updateAgreementMilestones'])->name('case-file.agreement-milestones');

        // ── Client payment requests ─────────────────────────────────────────────
        Route::get('{profile}/payment-requests',                              [ConsultantClientPaymentRequestController::class, 'index'])->name('payment-requests.index');
        Route::post('{profile}/payment-requests',                             [ConsultantClientPaymentRequestController::class, 'store'])->name('payment-requests.store');
        Route::post('{profile}/payment-requests/{paymentRequest}/cancel',     [ConsultantClientPaymentRequestController::class, 'cancel'])->name('payment-requests.cancel');
        Route::post('{profile}/payment-requests/{paymentRequest}/mark-paid',  [ConsultantClientPaymentRequestController::class, 'markPaid'])->name('payment-requests.mark-paid');
        Route::post('{profile}/payment-requests/{paymentRequest}/resend',     [ConsultantClientPaymentRequestController::class, 'resend'])->name('payment-requests.resend');

        Route::get('{profile}/meetings',                          [ConsultantClientMeetingController::class, 'index'])->name('meetings.index');
        Route::get('{profile}/meetings/availability',             [ConsultantClientMeetingController::class, 'availability'])->name('meetings.availability');
        Route::post('{profile}/meetings',                         [ConsultantClientMeetingController::class, 'store'])->name('meetings.store');
        Route::post('{profile}/meetings/{meeting}/cancel',        [ConsultantClientMeetingController::class, 'cancel'])->name('meetings.cancel');
        Route::post('{profile}/meetings/{meeting}/resend',        [ConsultantClientMeetingController::class, 'resend'])->name('meetings.resend');
        Route::patch('{profile}/case-file/checklist',              [CaseFileController::class, 'updateChecklist'])->name('case-file.checklist');

        // ── Document submissions (per-client) ─────────────────────────────────
        Route::get('{profile}/documents',                                   [DocumentSubmissionController::class, 'consultantIndex'])->name('documents.index');
        Route::get('{profile}/documents/{submission}/stream',               [SecurePdfController::class, 'consultantSubmission'])->name('documents.stream');
        Route::patch('{profile}/documents/{submission}/review',             [DocumentSubmissionController::class, 'review'])->name('documents.review');
        Route::patch('{profile}/case-pipeline',                             [DocumentSubmissionController::class, 'updatePipelineStatus'])->name('case-pipeline.update');

        // ── Messaging (per-client) ─────────────────────────────────────────────
        Route::get('{profile}/messages',                                    [CaseMessagingController::class, 'consultantIndex'])->name('messages.index');
        Route::post('{profile}/messages',                                   [CaseMessagingController::class, 'consultantSend'])->name('messages.send');
        Route::patch('{profile}/messages/mark-read',                        [CaseMessagingController::class, 'consultantMarkRead'])->name('messages.mark-read');

        // ── Questionnaire Review (consultant verifies client answers) ──────────
        Route::get('{profile}/questionnaire',                         [QuestionnaireReviewController::class, 'show'])->name('questionnaire.show');
        Route::get('{profile}/ai-advisor/state',                     [ConsultantWorkspaceAiAdvisorController::class, 'state'])->name('ai-advisor.state');
        Route::post('{profile}/ai-advisor/analyze',                   [ConsultantWorkspaceAiAdvisorController::class, 'analyze'])->name('ai-advisor.analyze');
        Route::post('{profile}/ai-advisor/chat',                     [ConsultantWorkspaceAiAdvisorController::class, 'chat'])->name('ai-advisor.chat');
        Route::get('{profile}/ai-advisor/documents',                  [ConsultantWorkspaceAiAdvisorController::class, 'documentsIndex'])->name('ai-advisor.documents.index');
        Route::post('{profile}/ai-advisor/documents',                 [ConsultantWorkspaceAiAdvisorController::class, 'documentsUpload'])->name('ai-advisor.documents.upload');
        Route::delete('{profile}/ai-advisor/documents/{document}',    [ConsultantWorkspaceAiAdvisorController::class, 'documentsDestroy'])->name('ai-advisor.documents.destroy');

        Route::get('{profile}/legislation/relevant', [ConsultantLegislationController::class, 'relevant'])->name('legislation.relevant');
        Route::get('{profile}/questionnaire/document/stream',         [QuestionnaireReviewController::class, 'streamDocument'])->name('questionnaire.document-stream');
        Route::patch('{profile}/questionnaire/verify',               [QuestionnaireReviewController::class, 'verify'])->name('questionnaire.verify');
        Route::patch('{profile}/questionnaire/field',                [QuestionnaireReviewController::class, 'updateField'])->name('questionnaire.update-field');
        Route::patch('{profile}/questionnaire/request-refill',       [QuestionnaireReviewController::class, 'requestRefill'])->name('questionnaire.request-refill');

        // ── Interactive IRCC forms (online-only application data) ───────────────
        Route::get('{profile}/interactive-forms/verification-status', [ConsultantIrccInteractiveFormController::class, 'verificationStatus'])->name('interactive-forms.verification-status');
        Route::get('{profile}/interactive-forms', [ConsultantIrccInteractiveFormController::class, 'index'])->name('interactive-forms.index');
        Route::get('{profile}/interactive-forms/{form}', [ConsultantIrccInteractiveFormController::class, 'show'])->name('interactive-forms.show');
        Route::patch('{profile}/interactive-forms/{form}/review', [ConsultantIrccInteractiveFormController::class, 'review'])->name('interactive-forms.review');
        Route::patch('{profile}/interactive-forms/{form}/verify-field', [ConsultantIrccInteractiveFormController::class, 'verifyField'])->name('interactive-forms.verify-field');

        // ── LMS: assign courses & track client progress ───────────────────────────
        Route::get('{profile}/lms', [ConsultantLmsController::class, 'index'])->name('lms.index');
        Route::post('{profile}/lms/assign', [ConsultantLmsController::class, 'assign'])->name('lms.assign');
        Route::delete('{profile}/lms/assignments/{assignment}', [ConsultantLmsController::class, 'unassign'])->name('lms.unassign');

        // ── Client Trust Account ledger (CICC-aligned) ───────────────────────────
        Route::get('{profile}/trust', [ConsultantClientTrustController::class, 'show'])->name('trust.show');
        Route::post('{profile}/trust/deposit', [ConsultantClientTrustController::class, 'recordDeposit'])->name('trust.deposit');
        Route::post('{profile}/trust/refund', [ConsultantClientTrustController::class, 'recordRefund'])->name('trust.refund');
        Route::post('{profile}/trust/milestones/{milestone}/complete', [ConsultantClientTrustController::class, 'completeMilestone'])->name('trust.milestones.complete');
        Route::post('{profile}/trust/milestones/{milestone}/invoice', [ConsultantClientTrustController::class, 'issueInvoice'])->name('trust.milestones.invoice');
        Route::post('{profile}/trust/invoices/{invoice}/release', [ConsultantClientTrustController::class, 'releaseInvoice'])->name('trust.invoices.release');

        // ── Activity & compliance audit log ─────────────────────────────────────
        Route::get('{profile}/activity-log', [ConsultantClientActivityController::class, 'index'])->name('activity-log');
        Route::get('{profile}/activity-log/pdf', [ConsultantClientActivityController::class, 'downloadPdf'])->name('activity-log.pdf');

        // ── Compliance packet (agreement + trust + docs + activity) ─────────────
        Route::get('{profile}/compliance-packet', [ConsultantClientComplianceController::class, 'preview'])->name('compliance-packet');
        Route::get('{profile}/compliance-packet/pdf', [ConsultantClientComplianceController::class, 'downloadPdf'])->name('compliance-packet.pdf');
    });

    Route::get('consultant/lms/courses', [ConsultantLmsController::class, 'availableCourses'])->name('consultant.lms.courses');

    // ── RCIC Community (consultant peer forum) ───────────────────────────────
    Route::prefix('consultant/rcic-community')->name('consultant.rcic-community.')->group(function () {
        Route::get('unread-count', [ConsultantRcicCommunityController::class, 'unreadCount'])->name('unread-count');
        Route::post('mark-seen', [ConsultantRcicCommunityController::class, 'markSeen'])->name('mark-seen');
        Route::get('posts', [ConsultantRcicCommunityController::class, 'index'])->name('posts.index');
        Route::post('posts', [ConsultantRcicCommunityController::class, 'store'])->name('posts.store');
        Route::get('posts/{post}', [ConsultantRcicCommunityController::class, 'show'])->name('posts.show');
        Route::delete('posts/{post}', [ConsultantRcicCommunityController::class, 'destroyPost'])->name('posts.destroy');
        Route::post('posts/{post}/replies', [ConsultantRcicCommunityController::class, 'storeReply'])->name('posts.replies.store');
        Route::post('posts/{post}/react', [ConsultantRcicCommunityController::class, 'toggleReaction'])->name('posts.react');
        Route::get('posts/{post}/attachment', [ConsultantRcicCommunityController::class, 'downloadAttachment'])->name('posts.attachment');
        Route::post('report', [ConsultantRcicCommunityController::class, 'report'])->name('report');
    });

    // ── Consultant support tickets ───────────────────────────────────────────
    Route::prefix('consultant/support-tickets')->name('consultant.support-tickets.')->group(function () {
        Route::get('unread-count', [ConsultantSupportTicketController::class, 'unreadCount'])->name('unread-count');
        Route::get('/', [ConsultantSupportTicketController::class, 'index'])->name('index');
        Route::post('/', [ConsultantSupportTicketController::class, 'store'])->name('store');
        Route::get('{ticket}', [ConsultantSupportTicketController::class, 'show'])->name('show');
        Route::post('{ticket}/messages', [ConsultantSupportTicketController::class, 'storeMessage'])->name('messages.store');
    });

    // ── Super Admin Dashboard ────────────────────────────────────────────────
    // Accessible by super-admin only.
    Route::middleware('role:super-admin')->prefix('admin')->name('admin.')->group(function () {

        // Overview stats
        Route::get('stats', [AdminStatsController::class, 'index'])->name('stats');

        // Consultant broadcasts (in-app + email + WhatsApp)
        Route::prefix('notifications/broadcasts')->name('notifications.broadcasts.')->group(function () {
            Route::get('/',              [AdminBroadcastController::class, 'index'])->name('index');
            Route::post('/',             [AdminBroadcastController::class, 'store'])->name('store');
            Route::post('{broadcast}/send', [AdminBroadcastController::class, 'send'])->name('send');
        });

        Route::prefix('email-templates')->name('email-templates.')->group(function () {
            Route::get('/', [AdminEmailTemplateController::class, 'index'])->name('index');
            Route::get('{key}/preview-bundle', [AdminEmailTemplateController::class, 'previewBundle'])
                ->where('key', '.*')
                ->name('preview-bundle');
            Route::get('{key}/preview', [AdminEmailTemplateController::class, 'preview'])
                ->where('key', '.*')
                ->name('preview');
        });

        Route::prefix('rcic-community')->name('rcic-community.')->group(function () {
            Route::get('posts', [AdminRcicCommunityController::class, 'posts'])->name('posts.index');
            Route::post('posts', [AdminRcicCommunityController::class, 'store'])->name('posts.store');
            Route::delete('posts/{post}', [AdminRcicCommunityController::class, 'destroyPost'])->name('posts.destroy');
            Route::patch('posts/{post}/hide', [AdminRcicCommunityController::class, 'hidePost'])->name('posts.hide');
            Route::delete('replies/{reply}', [AdminRcicCommunityController::class, 'destroyReply'])->name('replies.destroy');
            Route::patch('replies/{reply}/hide', [AdminRcicCommunityController::class, 'hideReply'])->name('replies.hide');
            Route::get('reports', [AdminRcicCommunityController::class, 'reports'])->name('reports.index');
            Route::patch('reports/{report}', [AdminRcicCommunityController::class, 'updateReport'])->name('reports.update');
        });

        Route::prefix('support-tickets')->name('support-tickets.')->group(function () {
            Route::get('/', [AdminSupportTicketController::class, 'index'])->name('index');
            Route::get('{ticket}', [AdminSupportTicketController::class, 'show'])->name('show');
            Route::post('{ticket}/messages', [AdminSupportTicketController::class, 'storeMessage'])->name('messages.store');
            Route::patch('{ticket}', [AdminSupportTicketController::class, 'update'])->name('update');
        });

        Route::prefix('whatsapp')->name('whatsapp.')->group(function () {
            Route::get('setup-status', [AdminWhatsAppInboxController::class, 'setupStatus'])->name('setup-status');
            Route::get('conversations', [AdminWhatsAppInboxController::class, 'index'])->name('conversations.index');
            Route::get('conversations/{conversation}', [AdminWhatsAppInboxController::class, 'show'])->name('conversations.show');
            Route::post('conversations/{conversation}/messages', [AdminWhatsAppInboxController::class, 'storeMessage'])->name('conversations.messages.store');
            Route::post('conversations/{conversation}/read', [AdminWhatsAppInboxController::class, 'markRead'])->name('conversations.read');
        });

        // User management
        Route::prefix('users')->name('users.')->group(function () {
            Route::get('/',                         [AdminUsersController::class, 'index'])->name('index');
            Route::post('/',                        [AdminUsersController::class, 'store'])->name('store');
            Route::get('{user}',                    [AdminUsersController::class, 'show'])->name('show');
            Route::put('{user}',                    [AdminUsersController::class, 'update'])->name('update');
            Route::patch('{user}/role',             [AdminUsersController::class, 'updateRole'])->name('role');
            Route::patch('{user}/toggle',           [AdminUsersController::class, 'toggleVerified'])->name('toggle');
            Route::delete('{user}',                 [AdminUsersController::class, 'destroy'])->name('destroy');
        });

        // CICC register — import / export / read
        Route::prefix('rcic-consultants')->name('rcic.')->group(function () {
            Route::get('export',         [AdminRcicController::class, 'export'])->name('export');
            Route::post('import',        [AdminRcicController::class, 'import'])->name('import');
            Route::delete('clear',       [AdminRcicController::class, 'clearAll'])->name('clear');
            Route::get('/',              [AdminRcicController::class, 'index'])->name('index');
            Route::post('/',             [AdminRcicController::class, 'store'])->name('store');
            Route::get('{profileId}',    [AdminRcicController::class, 'show'])->name('show');
            Route::put('{profileId}',    [AdminRcicController::class, 'update'])->name('update');
            Route::delete('{profileId}', [AdminRcicController::class, 'destroyOne'])->name('destroyOne');
        });

        // Immigration consultants CRUD
        Route::prefix('immigration-consultants')->name('immigration.')->group(function () {
            Route::get('/',      [AdminImmigrationConsultantController::class, 'index'])->name('index');
            Route::post('/',     [AdminImmigrationConsultantController::class, 'store'])->name('store');
            Route::get('{immigrationConsultant}',    [AdminImmigrationConsultantController::class, 'show'])->name('show');
            Route::put('{immigrationConsultant}',    [AdminImmigrationConsultantController::class, 'update'])->name('update');
            Route::delete('{immigrationConsultant}', [AdminImmigrationConsultantController::class, 'destroy'])->name('destroy');
        });

        // Payment gateway settings
        Route::prefix('payment-gateways')->name('payment-gateways.')->group(function () {
            Route::get('/',                          [AdminPaymentGatewayController::class, 'index'])->name('index');
            Route::put('{gateway}',                  [AdminPaymentGatewayController::class, 'update'])->name('update');
            Route::post('{gateway}/test',           [AdminPaymentGatewayController::class, 'testConnection'])->name('test');
            Route::delete('{gateway}/keys',          [AdminPaymentGatewayController::class, 'clearKeys'])->name('clearKeys');
        });

        // Integration credentials (Google OAuth, SMTP, Twilio, Zoom, Teams, AWS, OpenAI)
        Route::prefix('integration-settings')->name('integration-settings.')->group(function () {
            Route::get('/',                    [AdminIntegrationSettingsController::class, 'index'])->name('index');
            Route::put('{group}',              [AdminIntegrationSettingsController::class, 'update'])->name('update');
            Route::delete('{group}',           [AdminIntegrationSettingsController::class, 'clear'])->name('clear');
            Route::post('mail/test',           [AdminIntegrationSettingsController::class, 'testMail'])->name('mail.test');
            Route::post('openai/test',         [AdminIntegrationSettingsController::class, 'testOpenAi'])->name('openai.test');
            Route::post('whatsapp/test',       [AdminIntegrationSettingsController::class, 'testWhatsApp'])->name('whatsapp.test');
        });

        // Subscription packages
        Route::prefix('subscription-packages')->name('subscription-packages.')->group(function () {
            Route::get('/',                              [AdminSubscriptionPackageController::class, 'index'])->name('index');
            Route::post('/',                             [AdminSubscriptionPackageController::class, 'store'])->name('store');
            Route::get('{package}',                      [AdminSubscriptionPackageController::class, 'show'])->name('show');
            Route::put('{package}',                      [AdminSubscriptionPackageController::class, 'update'])->name('update');
            Route::patch('{package}/toggle',             [AdminSubscriptionPackageController::class, 'toggle'])->name('toggle');
            Route::delete('{package}',                   [AdminSubscriptionPackageController::class, 'destroy'])->name('destroy');
        });

        Route::prefix('storage-addon-packages')->name('storage-addon-packages.')->group(function () {
            Route::get('/',                              [AdminStorageAddonPackageController::class, 'index'])->name('index');
            Route::post('/',                             [AdminStorageAddonPackageController::class, 'store'])->name('store');
            Route::get('{storageAddonPackage}',          [AdminStorageAddonPackageController::class, 'show'])->name('show');
            Route::put('{storageAddonPackage}',          [AdminStorageAddonPackageController::class, 'update'])->name('update');
            Route::patch('{storageAddonPackage}/toggle', [AdminStorageAddonPackageController::class, 'toggle'])->name('toggle');
            Route::delete('{storageAddonPackage}',       [AdminStorageAddonPackageController::class, 'destroy'])->name('destroy');
        });

        Route::prefix('marketing-services')->name('marketing-services.')->group(function () {
            Route::get('/',                              [AdminMarketingServiceController::class, 'index'])->name('index');
            Route::post('/',                             [AdminMarketingServiceController::class, 'store'])->name('store');
            Route::get('{marketingService}',             [AdminMarketingServiceController::class, 'show'])->name('show');
            Route::put('{marketingService}',             [AdminMarketingServiceController::class, 'update'])->name('update');
            Route::patch('{marketingService}/toggle',    [AdminMarketingServiceController::class, 'toggle'])->name('toggle');
            Route::delete('{marketingService}',          [AdminMarketingServiceController::class, 'destroy'])->name('destroy');
        });

        Route::prefix('consultant-website-features')->name('consultant-website-features.')->group(function () {
            Route::get('/',                    [AdminConsultantWebsiteFeatureController::class, 'index'])->name('index');
            Route::post('/',                   [AdminConsultantWebsiteFeatureController::class, 'store'])->name('store');
            Route::put('{featureSection}',     [AdminConsultantWebsiteFeatureController::class, 'update'])->name('update');
            Route::patch('{featureSection}/toggle', [AdminConsultantWebsiteFeatureController::class, 'toggle'])->name('toggle');
            Route::delete('{featureSection}',  [AdminConsultantWebsiteFeatureController::class, 'destroy'])->name('destroy');
        });

        // Subscription payments
        Route::get('subscription-payments', [AdminSubscriptionPaymentsController::class, 'index'])->name('subscription-payments.index');
        Route::get('subscription-payments/export', [AdminSubscriptionPaymentsController::class, 'export'])->name('subscription-payments.export');
        Route::get('subscription-payments/{subscriptionPaymentRecord}', [AdminSubscriptionPaymentsController::class, 'show'])->name('subscription-payments.show');
        Route::get('subscription-payments/{subscriptionPaymentRecord}/invoice', [AdminSubscriptionPaymentsController::class, 'downloadInvoice'])->name('subscription-payments.invoice');
        Route::get('marketing-orders', [AdminMarketingOrdersController::class, 'index'])->name('marketing-orders.index');
        Route::get('marketing-orders/export', [AdminMarketingOrdersController::class, 'export'])->name('marketing-orders.export');
        Route::get('client-payment-requests', [AdminClientPaymentRequestsController::class, 'index'])->name('client-payment-requests.index');
        Route::get('client-payment-requests/export', [AdminClientPaymentRequestsController::class, 'export'])->name('client-payment-requests.export');
        Route::get('storage-subscriptions', [AdminStorageSubscriptionsController::class, 'index'])->name('storage-subscriptions.index');
        Route::get('storage-subscriptions/export', [AdminStorageSubscriptionsController::class, 'export'])->name('storage-subscriptions.export');

        Route::prefix('platform-company')->name('platform-company.')->group(function () {
            Route::get('/',              [AdminPlatformCompanyController::class, 'show'])->name('show');
            Route::put('/',              [AdminPlatformCompanyController::class, 'update'])->name('update');
            Route::post('logo',          [AdminPlatformCompanyController::class, 'uploadLogo'])->name('logo.upload');
            Route::delete('logo',         [AdminPlatformCompanyController::class, 'removeLogo'])->name('logo.remove');
        });

        // Stripe Test Clock — recurring billing simulation (test mode only)
        Route::prefix('stripe-test')->name('stripe-test.')->group(function () {
            Route::get('status',                              [AdminStripeTestController::class, 'status'])->name('status');
            Route::post('clock/enable',                       [AdminStripeTestController::class, 'enableClock'])->name('clock.enable');
            Route::post('clock/disable',                      [AdminStripeTestController::class, 'disableClock'])->name('clock.disable');
            Route::post('clock/advance',                      [AdminStripeTestController::class, 'advanceClock'])->name('clock.advance');
            Route::post('subscriptions/sync',                 [AdminStripeTestController::class, 'syncSubscriptions'])->name('subscriptions.sync');
            Route::post('subscriptions/{subscription}/sync',  [AdminStripeTestController::class, 'syncOne'])->name('subscriptions.sync-one');
        });

        // Legislation Hub — Canadian Acts & Regulations sync
        Route::prefix('legislation')->name('legislation.')->group(function () {
            Route::get('sync-status', [AdminLegislationController::class, 'syncStatus'])->name('sync-status');
            Route::get('catalog', [AdminLegislationController::class, 'catalog'])->name('catalog');
            Route::post('discover-catalog', [AdminLegislationController::class, 'discoverCatalog'])->name('discover-catalog');
            Route::post('catalog/{entry}/sync', [AdminLegislationController::class, 'syncCatalogEntry'])->name('catalog.sync');
            Route::get('sync-runs/{run}', [AdminLegislationController::class, 'syncRun'])->name('sync-run');
            Route::post('sync-runs/{run}/pause', [AdminLegislationController::class, 'pauseSyncRun'])->name('sync-run.pause');
            Route::post('sync-runs/{run}/resume', [AdminLegislationController::class, 'resumeSyncRun'])->name('sync-run.resume');
            Route::post('sync-runs/{run}/cancel', [AdminLegislationController::class, 'cancelSyncRun'])->name('sync-run.cancel');
            Route::post('sync', [AdminLegislationController::class, 'sync'])->name('sync');
            Route::post('clear', [AdminLegislationController::class, 'clearData'])->name('clear');
            Route::post('amendments/{alert}/acknowledge', [AdminLegislationController::class, 'acknowledgeAmendment'])->name('amendments.acknowledge');
            Route::get('resolve', [AdminLegislationController::class, 'resolve'])->name('resolve');
            Route::get('references/preview', [AdminLegislationController::class, 'previewReference'])->name('references.preview');
            Route::get('documents', [AdminLegislationController::class, 'documents'])->name('documents');
            Route::get('documents/{document}', [AdminLegislationController::class, 'showDocument'])->name('documents.show');
            Route::get('documents/{document}/download', [AdminLegislationController::class, 'downloadDocument'])->name('documents.download');
            Route::post('documents/{document}/analyze', [AdminLegislationController::class, 'analyzeDocument'])->name('documents.analyze');
            Route::post('documents/{document}/analyze-and-linkify', [AdminLegislationController::class, 'analyzeAndLinkify'])->name('documents.analyze-linkify');
            Route::get('documents/{document}/reference-cache', [AdminLegislationController::class, 'referenceCache'])->name('documents.reference-cache');
            Route::post('documents/{document}/apply-references', [AdminLegislationController::class, 'applyReferences'])->name('documents.apply-references');
            Route::get('documents/{document}/references', [AdminLegislationController::class, 'references'])->name('references.index');
            Route::post('documents/{document}/references', [AdminLegislationController::class, 'storeReference'])->name('references.store');
            Route::put('references/{reference}', [AdminLegislationController::class, 'updateReference'])->name('references.update');
            Route::post('references/{reference}/activate', [AdminLegislationController::class, 'activateReference'])->name('references.activate');
            Route::delete('references/{reference}', [AdminLegislationController::class, 'destroyReference'])->name('references.destroy');
        });

        // GST/HST — sales tax for payments (CRA place of supply)
        Route::prefix('gst-hst')->name('gst-hst.')->group(function () {
            Route::get('sync-status', [AdminGstHstController::class, 'syncStatus'])->name('sync-status');
            Route::post('sync',        [AdminGstHstController::class, 'sync'])->name('sync');
            Route::post('calculate',   [AdminGstHstController::class, 'calculate'])->name('calculate');
        });

        // CRS / pathway calculator — IRCC rules & Express Entry draws
        Route::prefix('crs-calculator')->name('crs-calculator.')->group(function () {
            Route::get('sync-status', [AdminCrsController::class, 'syncStatus'])->name('sync-status');
            Route::post('sync', [AdminCrsController::class, 'sync'])->name('sync');
        });

        // Application packages (IRCC forms & guides)
        Route::prefix('application-packages')->name('application-packages.')->group(function () {
            Route::get('sync-status', [AdminApplicationPackageController::class, 'syncStatus'])->name('sync-status');
            Route::post('sync-catalog', [AdminApplicationPackageController::class, 'syncCatalog'])->name('sync-catalog');
            Route::post('sync-interactive-forms', [AdminApplicationPackageController::class, 'syncInteractiveForms'])->name('sync-interactive-forms');
            Route::post('sync-all', [AdminApplicationPackageController::class, 'syncAll'])->name('sync-all');
            Route::get('tree', [AdminApplicationPackageController::class, 'tree'])->name('tree');
            Route::get('leaves', [AdminApplicationPackageController::class, 'leaves'])->name('leaves');
            Route::post('categories', [AdminApplicationPackageController::class, 'storeCategory'])->name('categories.store');
            Route::prefix('{category}/interactive-forms')->name('interactive-forms.')->group(function () {
                Route::get('/', [AdminIrccInteractiveFormController::class, 'index'])->name('index');
                Route::post('/', [AdminIrccInteractiveFormController::class, 'store'])->name('store');
                Route::get('{form}', [AdminIrccInteractiveFormController::class, 'show'])->name('show');
                Route::put('{form}', [AdminIrccInteractiveFormController::class, 'update'])->name('update');
                Route::delete('{form}', [AdminIrccInteractiveFormController::class, 'destroy'])->name('destroy');
            });
            Route::get('{category}', [AdminApplicationPackageController::class, 'show'])->name('show');
            Route::post('{category}/sync', [AdminApplicationPackageController::class, 'syncOne'])->name('sync-one');
            Route::put('{category}', [AdminApplicationPackageController::class, 'updateCategory'])->name('update');
            Route::delete('{category}', [AdminApplicationPackageController::class, 'destroyCategory'])->name('destroy');
            Route::post('{category}/documents', [AdminApplicationPackageController::class, 'uploadDocument'])->name('documents.store');
            Route::delete('{category}/documents/{document}', [AdminApplicationPackageController::class, 'destroyDocument'])->name('documents.destroy');
        });

        // IRCC news cache — force refresh
        Route::post('ircc-news/refresh', [IrccNewsController::class, 'refresh'])->name('ircc-news.refresh');

        // LMS — categories, courses, modules, lessons, quizzes
        Route::prefix('lms')->name('lms.')->group(function () {
            Route::get('categories', [AdminLmsController::class, 'categoriesIndex'])->name('categories.index');
            Route::post('categories', [AdminLmsController::class, 'categoriesStore'])->name('categories.store');
            Route::put('categories/{category}', [AdminLmsController::class, 'categoriesUpdate'])->name('categories.update');
            Route::delete('categories/{category}', [AdminLmsController::class, 'categoriesDestroy'])->name('categories.destroy');

            Route::get('courses', [AdminLmsController::class, 'coursesIndex'])->name('courses.index');
            Route::post('courses', [AdminLmsController::class, 'coursesStore'])->name('courses.store');
            Route::get('courses/{course}', [AdminLmsController::class, 'coursesShow'])->name('courses.show');
            Route::put('courses/{course}', [AdminLmsController::class, 'coursesUpdate'])->name('courses.update');
            Route::post('courses/{course}/thumbnail', [AdminLmsController::class, 'uploadThumbnail'])->name('courses.thumbnail');
            Route::delete('courses/{course}', [AdminLmsController::class, 'coursesDestroy'])->name('courses.destroy');

            Route::post('courses/{course}/modules', [AdminLmsController::class, 'modulesStore'])->name('modules.store');
            Route::put('modules/{module}', [AdminLmsController::class, 'modulesUpdate'])->name('modules.update');
            Route::delete('modules/{module}', [AdminLmsController::class, 'modulesDestroy'])->name('modules.destroy');

            Route::post('modules/{module}/lessons', [AdminLmsController::class, 'lessonsStore'])->name('lessons.store');
            Route::put('lessons/{lesson}', [AdminLmsController::class, 'lessonsUpdate'])->name('lessons.update');
            Route::delete('lessons/{lesson}', [AdminLmsController::class, 'lessonsDestroy'])->name('lessons.destroy');

            Route::post('courses/{course}/quizzes', [AdminLmsController::class, 'quizzesStore'])->name('quizzes.store');
            Route::put('quizzes/{quiz}', [AdminLmsController::class, 'quizzesUpdate'])->name('quizzes.update');
            Route::delete('quizzes/{quiz}', [AdminLmsController::class, 'quizzesDestroy'])->name('quizzes.destroy');

            Route::get('courses/{course}/question-bank', [AdminLmsController::class, 'questionBankIndex'])->name('question-bank.index');
            Route::post('courses/{course}/question-bank', [AdminLmsController::class, 'questionBankStore'])->name('question-bank.store');
            Route::put('question-bank/{question}', [AdminLmsController::class, 'questionBankUpdate'])->name('question-bank.update');
            Route::delete('question-bank/{question}', [AdminLmsController::class, 'questionBankDestroy'])->name('question-bank.destroy');
            Route::post('courses/{course}/question-bank/import', [AdminLmsController::class, 'questionBankImport'])->name('question-bank.import');
            Route::get('courses/{course}/question-bank/export', [AdminLmsController::class, 'questionBankExport'])->name('question-bank.export');

            Route::get('courses/{course}/homework', [AdminLmsController::class, 'homeworkIndex'])->name('homework.index');
            Route::post('courses/{course}/homework', [AdminLmsController::class, 'homeworkStore'])->name('homework.store');
            Route::delete('homework/{homework}', [AdminLmsController::class, 'homeworkDestroy'])->name('homework.destroy');
        });
    });
});

