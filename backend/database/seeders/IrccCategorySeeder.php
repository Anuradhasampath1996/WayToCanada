<?php

namespace Database\Seeders;

use App\Models\IrccCategory;
use Illuminate\Database\Seeder;

class IrccCategorySeeder extends Seeder
{
    public function run(): void
    {
        IrccCategory::truncate();

        $tree = [
            [
                'label' => 'Immigrate, visit, work or study',
                'children' => [
                    [
                        'label' => 'To visit or transit through Canada',
                        'children' => [
                            ['label' => 'Visitor visa (from outside Canada)',                    'result' => ['guide' => 'Guide 5256',  'checklist' => 'IMM 5488', 'forms' => ['IMM 5257', 'IMM 5645']]],
                            ['label' => 'Super Visa (Parents and Grandparents)',                 'result' => ['guide' => 'Guide 5256',  'checklist' => 'IMM 5488', 'forms' => ['IMM 5257', 'IMM 5645']]],
                            ['label' => 'Electronic Travel Authorization (eTA)',                 'result' => ['guide' => 'eTA Guide',   'checklist' => 'None',     'forms' => ['Online Form']]],
                            ['label' => 'Extend your stay as a visitor (from inside Canada)',    'result' => ['guide' => 'Guide 5551',  'checklist' => 'IMM 5556', 'forms' => ['IMM 5708']]],
                            ['label' => 'Transit visa (To pass through Canada)',                 'result' => ['guide' => 'Guide 5256',  'checklist' => 'IMM 5488', 'forms' => ['IMM 5257']]],
                        ],
                    ],
                    [
                        'label' => 'To study in Canada',
                        'children' => [
                            ['label' => 'Study permit from outside Canada',          'result' => ['guide' => 'Guide 5269',  'checklist' => 'IMM 5483', 'forms' => ['IMM 1294', 'IMM 5645', 'IMM 5257']]],
                            ['label' => 'Study permit from inside Canada',           'result' => ['guide' => 'Guide 5554',  'checklist' => 'IMM 5555', 'forms' => ['IMM 5709', 'IMM 5645']]],
                            ['label' => 'Extend your study permit',                  'result' => ['guide' => 'Guide 5552',  'checklist' => 'IMM 5555', 'forms' => ['IMM 5709']]],
                            ['label' => 'Work permit for students (Co-op / PGWP)',   'result' => ['guide' => 'Guide 5580',  'checklist' => 'IMM 5583', 'forms' => ['IMM 5710']]],
                        ],
                    ],
                    [
                        'label' => 'To work in Canada',
                        'children' => [
                            ['label' => 'Work permit from outside Canada', 'result' => ['guide' => 'Guide 5487', 'checklist' => 'IMM 5488', 'forms' => ['IMM 1295', 'IMM 5645']]],
                            ['label' => 'Work permit from inside Canada',  'result' => ['guide' => 'Guide 5553', 'checklist' => 'IMM 5556', 'forms' => ['IMM 5710']]],
                        ],
                    ],
                    [
                        'label' => 'To immigrate to Canada (Permanent Residence)',
                        'children' => [
                            ['label' => 'Express Entry (FSW, CEC, FST)',                    'result' => ['guide' => 'Express Entry Guide', 'checklist' => 'Dynamic e-APR',  'forms' => ['Online Web Forms']]],
                            ['label' => 'Provincial Nominee Program (PNP - Non-Express Entry)', 'result' => ['guide' => 'Guide 5609',        'checklist' => 'IMM 5610',      'forms' => ['IMM 0008', 'IMM 5669']]],
                        ],
                    ],
                ],
            ],
            [
                'label' => 'Citizenship',
                'children' => [
                    [
                        'label' => 'Become a Canadian citizen — Grant of Citizenship',
                        'children' => [
                            ['label' => 'Adults (18 years of age and older)', 'result' => ['guide' => 'Guide 0002', 'checklist' => 'CIT 0007', 'forms' => ['CIT 0002']]],
                            ['label' => 'Minors (under 18 years of age)',      'result' => ['guide' => 'Guide 0003', 'checklist' => 'CIT 0008', 'forms' => ['CIT 0003']]],
                        ],
                    ],
                    [
                        'label' => 'Get a certificate of citizenship — Proof of Citizenship',
                        'children' => [
                            ['label' => 'Apply for a citizenship certificate', 'result' => ['guide' => 'Guide 0001', 'checklist' => 'CIT 0014', 'forms' => ['CIT 0001']]],
                        ],
                    ],
                ],
            ],
            [
                'label' => 'Permanent Resident Cards',
                'children' => [
                    [
                        'label' => 'Get, renew or replace a Permanent Resident Card',
                        'children' => [
                            ['label' => 'Renew or replace a PR Card', 'result' => ['guide' => 'Guide 5445', 'checklist' => 'IMM 5444', 'forms' => ['IMM 5444', 'IMM 5455']]],
                        ],
                    ],
                ],
            ],
        ];

        foreach ($tree as $rootSort => $root) {
            $rootModel = IrccCategory::create([
                'parent_id'  => null,
                'level'      => 1,
                'label'      => $root['label'],
                'result'     => null,
                'sort_order' => $rootSort,
            ]);

            foreach ($root['children'] as $subSort => $sub) {
                $subModel = IrccCategory::create([
                    'parent_id'  => $rootModel->id,
                    'level'      => 2,
                    'label'      => $sub['label'],
                    'result'     => null,
                    'sort_order' => $subSort,
                ]);

                foreach ($sub['children'] as $leafSort => $leaf) {
                    IrccCategory::create([
                        'parent_id'  => $subModel->id,
                        'level'      => 3,
                        'label'      => $leaf['label'],
                        'result'     => $leaf['result'],
                        'sort_order' => $leafSort,
                    ]);
                }
            }
        }
    }
}
