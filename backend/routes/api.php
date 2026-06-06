<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\ConsultantRegisterController;
use App\Http\Controllers\Auth\ConsultantOnboardingController;
use App\Http\Controllers\Auth\PublicRegisterController;
use App\Http\Controllers\Admin\AdminApplicationPackageController;
use App\Http\Controllers\Admin\AdminIrccInteractiveFormController;
use App\Http\Controllers\Admin\AdminStatsController;
use App\Http\Controllers\Admin\AdminUsersController;
use App\Http\Controllers\Admin\AdminRcicController;
use App\Http\Controllers\Admin\AdminImmigrationConsultantController;
use App\Http\Controllers\Admin\AdminPaymentGatewayController;
use App\Http\Controllers\Admin\AdminSubscriptionPackageController;
use App\Http\Controllers\Admin\AdminSubscriptionPaymentsController;
use App\Http\Controllers\ApplicationPackageController;
use App\Http\Controllers\SecurePdfController;
use App\Http\Controllers\CaseFileController;
use App\Http\Controllers\CaseManagementHubController;
use App\Http\Controllers\CaseMessagingController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\ClientIrccInteractiveFormController;
use App\Http\Controllers\ConsultantIrccInteractiveFormController;
use App\Http\Controllers\ConsultantProfileController;
use App\Http\Controllers\ConsultantSubscriptionController;
use App\Http\Controllers\DocumentOcrController;
use App\Http\Controllers\DocumentSubmissionController;
use App\Http\Controllers\FileUploadController;
use App\Http\Controllers\IrccFormController;
use App\Http\Controllers\IrccNewsController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\PayPalWebhookController;
use App\Http\Controllers\QuestionnaireController;
use App\Http\Controllers\QuestionnaireReviewController;
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

// ── Public: IRCC news feed (no auth required — consultants & guests) ──────────
Route::get('ircc-news', [IrccNewsController::class, 'index'])->name('ircc-news.index');

// ── Public: IRCC Application Forms & Guides tree (no auth required) ──────────
Route::get('ircc-forms/tree', [IrccFormController::class, 'tree'])->name('ircc-forms.tree');

// ── Public: Case File — agreement (token-secured, no auth) ───────────────────
Route::prefix('case-file')->name('case-file.public.')->group(function () {
    Route::get('agreement/{token}',            [CaseFileController::class, 'getAgreement'])->name('agreement.get');
    Route::post('agreement/{token}/sign',      [CaseFileController::class, 'signAgreement'])->name('agreement.sign');
    Route::post('agreement/{token}/upload-doc',[CaseFileController::class, 'uploadSignedDoc'])->name('agreement.upload-doc');
});

// ── Public: PayPal webhook (no auth — verified via PayPal signature) ──────────
Route::post('webhooks/paypal', [PayPalWebhookController::class, 'handle'])
    ->name('webhooks.paypal');

// ── Authentication (Google OAuth + email/password) ───────────────────────────
Route::prefix('auth')->group(function () {
    Route::get('google/redirect',              [AuthController::class, 'redirectToGoogle'])->name('auth.google.redirect');
    Route::get('google/callback',              [AuthController::class, 'handleGoogleCallback'])->name('auth.google.callback');
    Route::get('google/consultant/redirect',   [ConsultantRegisterController::class, 'googleRedirect'])->name('auth.google.consultant.redirect');
    Route::get('google/consultant/login',      [AuthController::class, 'redirectToGoogleConsultantLogin'])->name('auth.google.consultant.login');
    Route::get('github/redirect',              [AuthController::class, 'redirectToGithubPublic'])->name('auth.github.redirect');
    Route::get('github/consultant/login',      [AuthController::class, 'redirectToGithubConsultantLogin'])->name('auth.github.consultant.login');
    Route::get('github/callback',              [AuthController::class, 'handleGithubCallback'])->name('auth.github.callback');
    Route::post('login',                       [AuthController::class, 'login'])->name('auth.login');

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

    // ── Consultant profile ────────────────────────────────────────────────────
    Route::get('consultant/profile',        [ConsultantProfileController::class, 'show'])->name('consultant.profile.show');
    Route::put('consultant/profile',        [ConsultantProfileController::class, 'update'])->name('consultant.profile.update');
    Route::post('consultant/profile/logo',      [ConsultantProfileController::class, 'uploadLogo'])->name('consultant.profile.logo');
    Route::post('consultant/profile/signature', [ConsultantProfileController::class, 'saveSignature'])->name('consultant.profile.signature');
    Route::get('consultant/rcic-registry',      [ConsultantProfileController::class, 'rcicRegistry'])->name('consultant.rcic-registry');

    // ── Consultant RCIC onboarding ────────────────────────────────────────────
    Route::post('consultant/onboarding', [ConsultantOnboardingController::class, 'submit'])
        ->name('consultant.onboarding');

    // ── Consultant subscription ───────────────────────────────────────────────
    Route::get('consultant/subscription',              [ConsultantSubscriptionController::class, 'status'])->name('consultant.subscription.status');
    Route::post('consultant/subscription/start-trial', [ConsultantSubscriptionController::class, 'startTrial'])->name('consultant.subscription.start-trial');
    Route::post('consultant/subscription/subscribe',   [ConsultantSubscriptionController::class, 'subscribe'])->name('consultant.subscription.subscribe');

    // ── Consultant PayPal payment ─────────────────────────────────────────────
    Route::prefix('consultant/payment/paypal')->name('consultant.payment.paypal.')->group(function () {
        Route::get('config',                    [PaymentController::class, 'paypalConfig'])->name('config');
        Route::post('create-order',             [PaymentController::class, 'createOrder'])->name('create-order');
        Route::post('capture-order',            [PaymentController::class, 'captureOrder'])->name('capture-order');
        // ── Subscriptions API (auto-renewal) ────────────────────────────────
        Route::post('subscription/create',      [PaymentController::class, 'createSubscription'])->name('subscription.create');
        Route::post('subscription/activate',    [PaymentController::class, 'activateSubscription'])->name('subscription.activate');
    });

    // ── Client: own journey dashboard ─────────────────────────────────────────
    Route::get('client/dashboard', [CaseFileController::class, 'clientDashboard'])->name('client.dashboard');
    Route::get('client/case-management-hub', [CaseManagementHubController::class, 'clientShow'])->name('client.case-management-hub');
    Route::get('client/package-documents/{document}/stream', [SecurePdfController::class, 'clientPackageDocument'])->name('client.package-documents.stream');
    Route::get('client/application-package', [ApplicationPackageController::class, 'clientShow'])->name('client.application-package');

    Route::prefix('client/interactive-forms')->name('client.interactive-forms.')->group(function () {
        Route::get('/', [ClientIrccInteractiveFormController::class, 'index'])->name('index');
        Route::get('{form}', [ClientIrccInteractiveFormController::class, 'show'])->name('show');
        Route::put('{form}', [ClientIrccInteractiveFormController::class, 'upsert'])->name('upsert');
        Route::post('{form}/submit', [ClientIrccInteractiveFormController::class, 'submit'])->name('submit');
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
        Route::get('/',       [QuestionnaireController::class, 'show'])->name('show');
        Route::put('/',       [QuestionnaireController::class, 'upsert'])->name('upsert');
        Route::post('/submit', [QuestionnaireController::class, 'submit'])->name('submit');
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
        Route::patch('{profile}/case-file/assign-application-package', [CaseFileController::class, 'assignApplicationPackage'])->name('case-file.assign-application-package');
        Route::post('{profile}/case-file/send-agreement',          [CaseFileController::class, 'sendAgreement'])->name('case-file.send-agreement');
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
        Route::get('{profile}/questionnaire',          [QuestionnaireReviewController::class, 'show'])->name('questionnaire.show');
        Route::patch('{profile}/questionnaire/verify', [QuestionnaireReviewController::class, 'verify'])->name('questionnaire.verify');
        Route::patch('{profile}/questionnaire/field',  [QuestionnaireReviewController::class, 'updateField'])->name('questionnaire.update-field');

        // ── Interactive IRCC forms (online-only application data) ───────────────
        Route::get('{profile}/interactive-forms/verification-status', [ConsultantIrccInteractiveFormController::class, 'verificationStatus'])->name('interactive-forms.verification-status');
        Route::get('{profile}/interactive-forms', [ConsultantIrccInteractiveFormController::class, 'index'])->name('interactive-forms.index');
        Route::get('{profile}/interactive-forms/{form}', [ConsultantIrccInteractiveFormController::class, 'show'])->name('interactive-forms.show');
        Route::patch('{profile}/interactive-forms/{form}/review', [ConsultantIrccInteractiveFormController::class, 'review'])->name('interactive-forms.review');
        Route::patch('{profile}/interactive-forms/{form}/verify-field', [ConsultantIrccInteractiveFormController::class, 'verifyField'])->name('interactive-forms.verify-field');
    });

    // ── Super Admin Dashboard ────────────────────────────────────────────────
    // Accessible by super-admin only.
    Route::middleware('role:super-admin')->prefix('admin')->name('admin.')->group(function () {

        // Overview stats
        Route::get('stats', [AdminStatsController::class, 'index'])->name('stats');

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
            Route::delete('{gateway}/keys',          [AdminPaymentGatewayController::class, 'clearKeys'])->name('clearKeys');
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

        // Subscription payments
        Route::get('subscription-payments', [AdminSubscriptionPaymentsController::class, 'index'])->name('subscription-payments.index');

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
    });
});

