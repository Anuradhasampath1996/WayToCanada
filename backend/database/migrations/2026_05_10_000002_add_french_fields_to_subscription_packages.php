<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_packages', function (Blueprint $table) {
            $table->string('name_fr')->nullable()->after('name');
            $table->text('description_fr')->nullable()->after('description');
            $table->json('features_fr')->nullable()->after('features');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_packages', function (Blueprint $table) {
            $table->dropColumn(['name_fr', 'description_fr', 'features_fr']);
        });
    }
};
