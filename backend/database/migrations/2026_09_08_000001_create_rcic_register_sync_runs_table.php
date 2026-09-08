<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->create('rcic_register_sync_runs', function (Blueprint $table) {
            $table->id();
            $table->string('status', 20)->default('pending'); // pending|running|completed|failed
            $table->string('trigger', 20)->default('manual'); // manual|scheduled|artisan
            $table->unsignedInteger('total_steps')->default(0);
            $table->unsignedInteger('completed_steps')->default(0);
            $table->string('current_step')->nullable();
            $table->json('stats')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('started_at');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('rcic_register_sync_runs');
    }
};
