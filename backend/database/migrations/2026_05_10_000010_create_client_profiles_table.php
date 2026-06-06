<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->table('users', function (Blueprint $table) {
            // Links a client back to the consultant who created them
            $table->foreignId('consultant_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete()
                ->after('id')
                ->comment('Set when the user was created by a consultant as a client');
        });

        Schema::connection('cws')->create('client_profiles', function (Blueprint $table) {
            $table->id();

            // The portal user account for this client
            $table->foreignId('user_id')
                ->unique()
                ->constrained('users')
                ->cascadeOnDelete();

            // The consultant who owns / manages this client
            $table->foreignId('consultant_id')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->string('phone')->nullable();
            $table->string('passport_number')->nullable();

            $table->string('immigration_pathway')->nullable()
                ->comment('e.g. Express Entry, PNP, Family Sponsorship, Study Permit…');

            // Groups spouses / dependents under one file
            $table->unsignedBigInteger('family_id')->nullable()
                ->comment('Shared across spouse and dependents for the same family unit');

            $table->text('notes')->nullable()
                ->comment('Private consultant notes about this client');

            $table->timestamp('invited_at')->nullable()
                ->comment('When the invitation email was sent');

            $table->timestamps();

            $table->index('consultant_id');
            $table->index('family_id');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->dropIfExists('client_profiles');

        Schema::connection('cws')->table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('consultant_id');
        });
    }
};
