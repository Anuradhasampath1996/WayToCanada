<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->create('rcic_community_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 255);
            $table->text('body');
            $table->string('attachment_path')->nullable();
            $table->string('attachment_name')->nullable();
            $table->string('attachment_mime', 120)->nullable();
            $table->unsignedInteger('attachment_size')->nullable();
            $table->unsignedInteger('reactions_count')->default(0);
            $table->unsignedInteger('replies_count')->default(0);
            $table->boolean('is_hidden')->default(false);
            $table->timestamp('hidden_at')->nullable();
            $table->foreignId('hidden_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['is_hidden', 'created_at']);
        });

        Schema::connection('cws')->create('rcic_community_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('rcic_community_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->boolean('is_hidden')->default(false);
            $table->timestamp('hidden_at')->nullable();
            $table->foreignId('hidden_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['post_id', 'is_hidden', 'created_at']);
        });

        Schema::connection('cws')->create('rcic_community_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('rcic_community_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('reaction', 20)->default('like');
            $table->timestamps();

            $table->unique(['post_id', 'user_id']);
        });

        Schema::connection('cws')->create('rcic_community_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
            $table->string('reportable_type', 20);
            $table->unsignedBigInteger('reportable_id');
            $table->text('reason');
            $table->string('status', 20)->default('pending');
            $table->text('admin_notes')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['reportable_type', 'reportable_id']);
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('rcic_community_reports');
        Schema::connection('cws')->dropIfExists('rcic_community_reactions');
        Schema::connection('cws')->dropIfExists('rcic_community_replies');
        Schema::connection('cws')->dropIfExists('rcic_community_posts');
    }
};
