<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('cicc_email')->nullable()->comment('Official CICC-registered email for RCIC OTP delivery');
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->nullable()->comment('Null for Google OAuth only accounts');
            $table->string('google_id')->nullable()->unique();
            $table->string('avatar')->nullable();
            $table->enum('locale', ['en', 'fr'])->default('en');
            $table->boolean('is_verified')->default(false)->comment('RCIC: verified against rcic_export.csv');
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::connection('cws')->create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('password_reset_tokens');
        Schema::connection('cws')->dropIfExists('users');
    }
};
