<?php

namespace Database\Seeders;

use App\Models\Lms\LmsCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class LmsCategorySeeder extends Seeder
{
    public function run(): void
    {
        $streams = [
            ['name' => 'IELTS', 'description' => 'International English Language Testing System preparation'],
            ['name' => 'CELPIP', 'description' => 'Canadian English Language Proficiency Index Program'],
            ['name' => 'PTE', 'description' => 'Pearson Test of English Academic preparation'],
            ['name' => 'NCLEX', 'description' => 'National Council Licensure Examination for nurses'],
            ['name' => 'TEF', 'description' => 'Test d\'évaluation de français for Canadian immigration'],
        ];

        foreach ($streams as $i => $stream) {
            LmsCategory::firstOrCreate(
                ['slug' => Str::slug($stream['name'])],
                [
                    'name'        => $stream['name'],
                    'description' => $stream['description'],
                    'sort_order'  => $i,
                    'is_active'   => true,
                ]
            );
        }

        if ($this->command) {
            $this->command->info('LMS exam categories seeded: IELTS, CELPIP, PTE, NCLEX, TEF');
        }
    }
}
