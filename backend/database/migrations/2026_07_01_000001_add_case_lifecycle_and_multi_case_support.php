<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->unsignedSmallInteger('case_number')->default(1)->after('client_profile_id');
            $table->string('lifecycle_status', 32)->default('active')->after('status');
            $table->text('lifecycle_note')->nullable()->after('lifecycle_status');
            $table->timestamp('lifecycle_changed_at')->nullable()->after('lifecycle_note');
        });

        // Drop one-case-per-client constraint (allow multiple cases).
        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->dropUnique(['client_profile_id']);
            $table->unique(['client_profile_id', 'case_number']);
        });

        Schema::connection('cws')->table('client_profiles', function (Blueprint $table) {
            $table->foreignId('active_case_file_id')
                ->nullable()
                ->after('consultant_id')
                ->constrained('case_files')
                ->nullOnDelete();
        });

        // Backfill active_case_file_id from existing single case per profile.
        $pairs = DB::connection('cws')
            ->table('case_files')
            ->select('id', 'client_profile_id')
            ->orderBy('id')
            ->get();

        foreach ($pairs as $row) {
            DB::connection('cws')
                ->table('client_profiles')
                ->where('id', $row->client_profile_id)
                ->whereNull('active_case_file_id')
                ->update(['active_case_file_id' => $row->id]);
        }
    }

    public function down(): void
    {
        Schema::connection('cws')->table('client_profiles', function (Blueprint $table) {
            $table->dropConstrainedForeignId('active_case_file_id');
        });

        Schema::connection('cws')->table('case_files', function (Blueprint $table) {
            $table->dropUnique(['client_profile_id', 'case_number']);
            $table->dropColumn(['case_number', 'lifecycle_status', 'lifecycle_note', 'lifecycle_changed_at']);
            $table->unique('client_profile_id');
        });
    }
};
