<?php

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
use App\Http\Controllers\Admin\AdminStatsController;
use App\Http\Controllers\Admin\AdminUsersController;
use App\Http\Controllers\Admin\AdminRcicController;
use App\Http\Controllers\Admin\AdminImmigrationConsultantController;
use App\Http\Controllers\Admin\AdminPaymentGatewayController;
use App\Http\Controllers\Admin\AdminStripeTestController;
use App\Http\Controllers\Admin\AdminSubscriptionPackageController;
use App\Http\Controllers\Admin\AdminSubscriptionPaymentsController;
use App\Http\Controllers\Admin\AdminLmsController;
use App\Http\Controllers\Consultant\ConsultantLmsController;
use App\Http\Controllers\Consultant\ConsultantPaymentAccountController;
use App\Http\Controllers\Consultant\ConsultantClientPaymentRequestController;
use App\Http\Controllers\Consultant\ConsultantMeetingAccountController;
use App\Http\Controllers\Consultant\ConsultantMeetingOAuthController;
use App\Http\Controllers\Consultant\ConsultantCalendarController;
use App\Http\Controllers\Consultant\ConsultantClientMeetingController;
use App\Http\Controllers\Consultant\ConsultantClientActivityController;
use App\Http\Controllers\Consultant\ConsultantClientTrustController;
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
use App\Http\Controllers\Admin\AdminConsultantWebsiteFeatureController;
use App\Http\Controllers\StripeWebhookController;
use App\Http\Controllers\QuestionnaireController;
use App\Http\Controllers\QuestionnaireReviewController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\NotificationPreferenceController;
use App\Http\Controllers\Admin\AdminBroadcastController;
use App\Http\Controllers\Admin\AdminIntegrationSettingsController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — WayToCanada v1
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
Route::prefix('payment-request')->name('payment-request.public.')->group(function () {
    Route::get('{token}',                [PublicPaymentRequestController::class, 'show'])->name('show');
    Route::post('{token}/checkout',      [PublicPaymentRequestController::class, 'checkout'])->name('checkout');
    Route::post('{token}/confirm-sent', [PublicPaymentRequestController::class, 'confirmSent'])->name('confirm-sent');
    Route::post('{token}/verify',        [PublicPaymentRequestController::class, 'verify'])->name('verify');
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

// ── Protected routes ─────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {
    Route::get('me',      [AuthController::class, 'me'])->name('auth.me');
    Route::post('logout', [AuthController::class, 'logout'])->name('auth.logout');
    Route::post('set-password', [AuthController::class, 'setPassword'])->name('auth.set-password');

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

    // ── Consultant RCIC onboarding ────────────────────────────────────────────
    Route::post('consultant/onboarding', [ConsultantOnboardingController::class, 'submit'])
        ->name('consultant.onboarding');

    // ── Consultant subscription ───────────────────────────────────────────────
    Route::get('consultant/subscription',              [ConsultantSubscriptionController::class, 'status'])->name('consultant.subscription.status');
    Route::post('consultant/subscription/start-trial', [ConsultantSubscriptionController::class, 'startTrial'])->name('consultant.subscription.start-trial');
    Route::post('consultant/subscription/subscribe',   [ConsultantSubscriptionController::class, 'subscribe'])->name('consultant.subscription.subscribe');

    Route::prefix('consultant/billing')->name('consultant.billing.')->group(function () {
        Route::get('/',           [ConsultantBillingController::class, 'show'])->name('show');
        Route::get('invoices',    [ConsultantBillingController::class, 'invoices'])->name('invoices');
        Route::post('cancel',     [ConsultantBillingController::class, 'cancel'])->name('cancel');
    });

    // ── Consultant Stripe payment ─────────────────────────────────────────────
    Route::prefix('consultant/payment/stripe')->name('consultant.payment.stripe.')->group(function () {
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
        Route::prefix('payment')->name('payment.')->group(function () {
            Route::get('tax-quote',                  [ConsultantStoragePaymentController::class, 'taxQuote'])->name('tax-quote');
            Route::post('checkout-session',           [ConsultantStoragePaymentController::class, 'createCheckoutSession'])->name('checkout-session');
            Route::post('verify-session',             [ConsultantStoragePaymentController::class, 'verifySession'])->name('verify-session');
        });
    });

    // ── Client: own journey dashboard ─────────────────────────────────────────
    Route::get('client/dashboard', [CaseFileController::class, 'clientDashboard'])->name('client.dashboard');
    Route::get('client/trust', [ClientTrustController::class, 'show'])->name('client.trust.show');
    Route::post('client/trust/invoices/{invoice}/approve', [ClientTrustController::class, 'approveInvoice'])->name('client.trust.invoices.approve');
    Route::get('client/case-management-hub', [CaseManagementHubController::class, 'clientShow'])->name('client.case-management-hub');
    Route::get('client/package-documents/{document}/stream', [SecurePdfController::class, 'clientPackageDocument'])->name('client.package-documents.stream');
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
        Route::get('documents', [LegislationController::class, 'documents'])->name('documents');
        Route::get('documents/{document}', [LegislationController::class, 'show'])->name('documents.show');
        Route::get('documents/{document}/download', [LegislationController::class, 'download'])->name('documents.download');
        Route::get('resolve', [LegislationController::class, 'resolve'])->name('resolve');
    });

    // ── Consultant: Case Pipeline (Kanban — all signed clients) ──────────────
    Route::get('consultant/case-pipeline', [DocumentSubmissionController::class, 'pipeline'])->name('consultant.case-pipeline');

    // ── Consultant: Client Management ─────────────────────────────────────────
    Route::prefix('consultant/clients')->name('consultant.clients.')->group(function () {        Route::get('/',                              [ClientController::class, 'index'])->name('index');
        Route::post('/',                             [ClientController::class, 'store'])->name('store');
        Route::get('{profile}',                      [ClientController::class, 'show'])->name('show');
        Route::put('{profile}',                      [ClientController::class, 'update'])->name('update');
        Route::delete('{profile}',                   [ClientController::class, 'destroy'])->name('destroy');
        Route::post('{profile}/resend-invite',        [ClientController::class, 'resendInvite'])->name('resend-invite');
        Route::patch('{profile}/toggle-status',         [ClientController::class, 'toggleStatus'])->name('toggle-status');

        // ── Case File / Workspace ──────────────────────────────────────────────
        Route::get('{profile}/case-file',                          [CaseFileController::class, 'show'])->name('case-file.show');
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
    });

    Route::get('consultant/lms/courses', [ConsultantLmsController::class, 'availableCourses'])->name('consultant.lms.courses');

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

        Route::prefix('consultant-website-features')->name('consultant-website-features.')->group(function () {
            Route::get('/',                    [AdminConsultantWebsiteFeatureController::class, 'index'])->name('index');
            Route::post('/',                   [AdminConsultantWebsiteFeatureController::class, 'store'])->name('store');
            Route::put('{featureSection}',     [AdminConsultantWebsiteFeatureController::class, 'update'])->name('update');
            Route::patch('{featureSection}/toggle', [AdminConsultantWebsiteFeatureController::class, 'toggle'])->name('toggle');
            Route::delete('{featureSection}',  [AdminConsultantWebsiteFeatureController::class, 'destroy'])->name('destroy');
        });

        // Subscription payments
        Route::get('subscription-payments', [AdminSubscriptionPaymentsController::class, 'index'])->name('subscription-payments.index');

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
            Route::post('sync', [AdminLegislationController::class, 'sync'])->name('sync');
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

