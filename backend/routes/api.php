<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\ConsultantRegisterController;
use App\Http\Controllers\Auth\ConsultantOnboardingController;
use App\Http\Controllers\Auth\PublicRegisterController;
use App\Http\Controllers\Admin\AdminStatsController;
use App\Http\Controllers\Admin\AdminUsersController;
use App\Http\Controllers\Admin\AdminRcicController;
use App\Http\Controllers\Admin\AdminImmigrationConsultantController;
use App\Http\Controllers\Admin\AdminPaymentGatewayController;
use App\Http\Controllers\Admin\AdminSubscriptionPackageController;
use App\Http\Controllers\Admin\AdminSubscriptionPaymentsController;
use App\Http\Controllers\ConsultantSubscriptionController;
use App\Http\Controllers\FileUploadController;
use App\Http\Controllers\IrccNewsController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\PayPalWebhookController;
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
});

// ── Protected routes ─────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {
    Route::get('me',      [AuthController::class, 'me'])->name('auth.me');
    Route::post('logout', [AuthController::class, 'logout'])->name('auth.logout');

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

        // IRCC news cache — force refresh
        Route::post('ircc-news/refresh', [IrccNewsController::class, 'refresh'])->name('ircc-news.refresh');
    });
});

