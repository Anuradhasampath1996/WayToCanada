<?php

use App\Services\Team\TeamPermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    protected $connection = 'cws';

    public function up(): void
    {
        $schema = Schema::connection('cws');

        if (! $schema->hasTable('consultant_workspaces')) {
            $schema->create('consultant_workspaces', function (Blueprint $table) {
                $table->id();
                $table->foreignId('owner_user_id')->unique()->constrained('users')->restrictOnDelete();
                $table->string('name');
                $table->unsignedInteger('seat_limit_override')->nullable();
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('consultant_workspace_members')) {
            $schema->create('consultant_workspace_members', function (Blueprint $table) {
                $table->id();
                $table->foreignId('workspace_id')->constrained('consultant_workspaces')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('job_title')->nullable();
                $table->string('preset_key')->nullable();
                $table->string('access_scope', 32)->default('assigned_cases');
                $table->json('allowed_case_file_ids')->nullable();
                $table->json('allowed_client_profile_ids')->nullable();
                $table->string('status', 32)->default('active');
                $table->timestamp('last_login_at')->nullable();
                $table->timestamp('deactivated_at')->nullable();
                $table->timestamps();
                $table->unique(['workspace_id', 'user_id']);
                $table->index(['user_id', 'status']);
            });
        }

        if (! $schema->hasTable('consultant_workspace_member_permissions')) {
            $schema->create('consultant_workspace_member_permissions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('member_id')->unique()->constrained('consultant_workspace_members')->cascadeOnDelete();
                $table->json('permissions');
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('consultant_workspace_invitations')) {
            $schema->create('consultant_workspace_invitations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('workspace_id')->constrained('consultant_workspaces')->cascadeOnDelete();
                $table->string('email');
                $table->string('name');
                $table->string('job_title')->nullable();
                $table->string('preset_key')->nullable();
                $table->string('access_scope', 32)->default('assigned_cases');
                $table->json('allowed_case_file_ids')->nullable();
                $table->json('permissions_snapshot');
                $table->string('token_hash', 64)->unique();
                $table->timestamp('expires_at');
                $table->timestamp('accepted_at')->nullable();
                $table->timestamp('revoked_at')->nullable();
                $table->foreignId('invited_by')->constrained('users')->cascadeOnDelete();
                $table->foreignId('accepted_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['workspace_id', 'email']);
                $table->index('expires_at');
            });
        }

        if (! $schema->hasTable('team_permission_presets')) {
            $schema->create('team_permission_presets', function (Blueprint $table) {
                $table->id();
                $table->string('key')->unique();
                $table->string('name');
                $table->text('description')->nullable();
                $table->json('permissions');
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('case_team_assignments')) {
            $schema->create('case_team_assignments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('case_file_id')->constrained('case_files')->cascadeOnDelete();
                $table->foreignId('member_id')->constrained('consultant_workspace_members')->cascadeOnDelete();
                $table->string('assignment_role', 32)->default('collaborator');
                $table->foreignId('assigned_by')->constrained('users')->cascadeOnDelete();
                $table->timestamps();
                $table->unique(['case_file_id', 'member_id']);
                $table->index('member_id');
            });
        }

        if (! $schema->hasTable('team_audit_events')) {
            $schema->create('team_audit_events', function (Blueprint $table) {
                $table->id();
                $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('workspace_id')->nullable()->constrained('consultant_workspaces')->nullOnDelete();
                $table->string('action', 64);
                $table->string('subject_type', 64);
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->json('before')->nullable();
                $table->json('after')->nullable();
                $table->string('ip', 45)->nullable();
                $table->timestamps();
                $table->index(['workspace_id', 'created_at']);
            });
        }

        Role::findOrCreate('staff', 'sanctum');

        $catalog = app(TeamPermissionCatalog::class);
        $descriptions = [
            'case_manager' => 'Broad case operations except licensed consultant finals.',
            'case_worker' => 'Day-to-day work on assigned cases.',
            'assistant' => 'Notes, tasks, calendar, and communications.',
            'document_specialist' => 'Documents and form preparation.',
            'billing_staff' => 'No platform billing in v1. Template only.',
            'read_only' => 'View-only access on scoped cases.',
        ];
        foreach ($catalog->presets() as $key => $preset) {
            DB::connection('cws')->table('team_permission_presets')->updateOrInsert(
                ['key' => $key],
                [
                    'name' => $preset['name'],
                    'description' => $descriptions[$key] ?? null,
                    'permissions' => json_encode($catalog->fromPreset($key)),
                    'updated_at' => now(),
                    'created_at' => now(),
                ],
            );
        }
    }

    public function down(): void
    {
        $schema = Schema::connection('cws');
        $schema->dropIfExists('team_audit_events');
        $schema->dropIfExists('case_team_assignments');
        $schema->dropIfExists('consultant_workspace_invitations');
        $schema->dropIfExists('consultant_workspace_member_permissions');
        $schema->dropIfExists('consultant_workspace_members');
        $schema->dropIfExists('team_permission_presets');
        $schema->dropIfExists('consultant_workspaces');
    }
};
