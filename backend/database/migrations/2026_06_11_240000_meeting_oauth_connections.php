<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cws')->table('consultant_meeting_accounts', function (Blueprint $table) {
            $table->string('google_account_email')->nullable()->after('google_meet_url');
            $table->text('google_access_token')->nullable();
            $table->text('google_refresh_token')->nullable();
            $table->timestamp('google_token_expires_at')->nullable();
            $table->timestamp('google_connected_at')->nullable();

            $table->string('zoom_account_email')->nullable()->after('zoom_meeting_url');
            $table->text('zoom_access_token')->nullable();
            $table->text('zoom_refresh_token')->nullable();
            $table->timestamp('zoom_token_expires_at')->nullable();
            $table->timestamp('zoom_connected_at')->nullable();

            $table->string('teams_account_email')->nullable()->after('teams_meeting_url');
            $table->text('teams_access_token')->nullable();
            $table->text('teams_refresh_token')->nullable();
            $table->timestamp('teams_token_expires_at')->nullable();
            $table->timestamp('teams_connected_at')->nullable();
        });

        Schema::connection('cws')->table('client_meetings', function (Blueprint $table) {
            $table->string('external_meeting_id')->nullable()->after('meeting_url');
            $table->string('calendar_event_id')->nullable()->after('external_meeting_id');
        });
    }

    public function down(): void
    {
        Schema::connection('cws')->table('client_meetings', function (Blueprint $table) {
            $table->dropColumn(['external_meeting_id', 'calendar_event_id']);
        });

        Schema::connection('cws')->table('consultant_meeting_accounts', function (Blueprint $table) {
            $table->dropColumn([
                'google_account_email', 'google_access_token', 'google_refresh_token',
                'google_token_expires_at', 'google_connected_at',
                'zoom_account_email', 'zoom_access_token', 'zoom_refresh_token',
                'zoom_token_expires_at', 'zoom_connected_at',
                'teams_account_email', 'teams_access_token', 'teams_refresh_token',
                'teams_token_expires_at', 'teams_connected_at',
            ]);
        });
    }
};
