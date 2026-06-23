<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->create('consultant_legislation_bookmarks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consultant_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('client_profile_id')->nullable()->constrained('client_profiles')->nullOnDelete();
            $table->string('act_code', 40);
            $table->string('provision_key', 80);
            $table->string('language', 8)->default('en');
            $table->string('label')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->unique(
                ['consultant_id', 'client_profile_id', 'act_code', 'provision_key', 'language'],
                'consultant_leg_bookmark_unique',
            );
        });

        Schema::connection('cws')->table('consultant_client_ai_chat_messages', function (Blueprint $table) {
            $table->json('metadata')->nullable()->after('openai_used');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('consultant_client_ai_chat_messages', function (Blueprint $table) {
            $table->dropColumn('metadata');
        });

        Schema::connection('cws')->dropIfExists('consultant_legislation_bookmarks');
    }
};
