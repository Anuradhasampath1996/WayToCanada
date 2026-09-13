<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection('cws');
        $db = DB::connection('cws');

        if ($schema->hasTable('consultant_subscriptions')) {
            $this->relaxSubscriptionStatusColumn($db);

            $schema->table('consultant_subscriptions', function (Blueprint $table) use ($schema) {
                if (! $schema->hasColumn('consultant_subscriptions', 'past_due_started_at')) {
                    $table->timestamp('past_due_started_at')->nullable()->after('cancelled_at');
                }
            });
        }

        if (! $schema->hasTable('stripe_webhook_events')) {
            $schema->create('stripe_webhook_events', function (Blueprint $table) {
                $table->id();
                $table->string('event_id', 128)->unique();
                $table->string('type', 128);
                $table->timestamp('processed_at')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('consultant_subscription_plan_changes')) {
            $schema->create('consultant_subscription_plan_changes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('consultant_subscription_id')->constrained('consultant_subscriptions')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('from_package_id')->nullable()->constrained('subscription_packages')->nullOnDelete();
                $table->foreignId('to_package_id')->constrained('subscription_packages')->restrictOnDelete();
                $table->string('from_billing_cycle', 20)->nullable();
                $table->string('to_billing_cycle', 20);
                $table->string('from_stripe_price_id', 64)->nullable();
                $table->string('to_stripe_price_id', 64)->nullable();
                $table->string('proration_behavior', 32)->nullable();
                $table->decimal('immediate_charge', 10, 2)->nullable();
                $table->decimal('credit_amount', 10, 2)->nullable();
                $table->decimal('tax_amount', 10, 2)->nullable();
                $table->string('currency', 8)->default('CAD');
                $table->string('stripe_invoice_id')->nullable();
                $table->string('result', 32)->default('succeeded');
                $table->text('error_message')->nullable();
                $table->json('preview')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        $schema = Schema::connection('cws');

        $schema->dropIfExists('consultant_subscription_plan_changes');
        $schema->dropIfExists('stripe_webhook_events');

        if ($schema->hasTable('consultant_subscriptions') && $schema->hasColumn('consultant_subscriptions', 'past_due_started_at')) {
            $schema->table('consultant_subscriptions', function (Blueprint $table) {
                $table->dropColumn('past_due_started_at');
            });
        }
    }

    private function relaxSubscriptionStatusColumn($db): void
    {
        $driver = $db->getDriverName();

        if ($driver === 'pgsql') {
            $db->statement('ALTER TABLE consultant_subscriptions DROP CONSTRAINT IF EXISTS consultant_subscriptions_status_check');
            $db->statement('ALTER TABLE consultant_subscriptions ALTER COLUMN status TYPE VARCHAR(32) USING status::text');
            $db->statement("ALTER TABLE consultant_subscriptions ALTER COLUMN status SET DEFAULT 'trial'");

            return;
        }

        Schema::connection('cws')->table('consultant_subscriptions', function (Blueprint $table) {
            $table->string('status', 32)->default('trial')->change();
        });
    }
};
