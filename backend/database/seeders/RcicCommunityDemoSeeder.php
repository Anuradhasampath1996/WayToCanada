<?php

namespace Database\Seeders;

use App\Models\RcicCommunityPost;
use App\Models\RcicCommunityReaction;
use App\Models\RcicCommunityReply;
use App\Models\RcicCommunityReport;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Fresh RCIC Community sample feed for local demo / UI review.
 * Clears existing community posts and seeds a realistic discussion board.
 */
class RcicCommunityDemoSeeder extends Seeder
{
    public function run(): void
    {
        $primary = User::where('email', 'anuradhasampath666@gmail.com')->first();
        if (! $primary) {
            $this->command?->warn('Consultant anuradhasampath666@gmail.com not found — skip.');

            return;
        }

        // Wipe existing community content for a clean view
        RcicCommunityReport::query()->delete();
        RcicCommunityReaction::query()->delete();
        RcicCommunityReply::query()->delete();
        RcicCommunityPost::query()->delete();

        $authors = collect([
            $primary,
            $this->ensureDemoRcic(
                'anuradhasampath64@gmail.com',
                'Anuradha Sampath',
                'R711223344',
                'Maple Pathway Consulting',
                'Toronto'
            ),
            $this->ensureDemoRcic(
                'demo.rcic.priya@example.com',
                'Priya Sharma',
                'R556677889',
                'Northern Gate Immigration',
                'Vancouver'
            ),
            $this->ensureDemoRcic(
                'demo.rcic.marcus@example.com',
                'Marcus Chen',
                'R998877665',
                'Pacific Bridge RCIC',
                'Calgary'
            ),
            $this->ensureDemoRcic(
                'demo.rcic.amina@example.com',
                'Amina Hassan',
                'R334455667',
                'Horizon Citizenship Services',
                'Ottawa'
            ),
        ])->filter()->values();

        $postsPlan = [
            [
                'author' => 0,
                'hours'  => 3,
                'title'  => 'CRS draw timing — how are you advising clients this month?',
                'body'   => "Curious how other RCICs are framing expectations around Express Entry draws right now.\n\nI'm telling clients to focus on language + credential readiness rather than chasing the next cutoff. Anyone using a different approach?",
                'replies'=> [
                    ['author' => 2, 'hours' => 2, 'body' => 'Same here. I also document the advice in writing so clients remember we never promise draw outcomes.'],
                    ['author' => 3, 'hours' => 1, 'body' => 'We run a short CRS readiness checklist before every strategy call. Happy to share the template if useful.'],
                ],
                'reactors' => [1, 2, 3],
            ],
            [
                'author' => 2,
                'hours'  => 18,
                'title'  => 'Study permit refusals after PAL — common gaps you are seeing?',
                'body'   => "Seeing more refusals where the financial narrative is weak even when the numbers look fine on paper.\n\nWhat supporting docs are you attaching beyond bank statements for Sri Lanka / India files?",
                'replies'=> [
                    ['author' => 0, 'hours' => 12, 'body' => 'We add a short letter explaining income sources + 6 months of consistent history. Helped on two recent files.'],
                    ['author' => 4, 'hours' => 8, 'body' => 'Also watch for tuition payment timing vs. LOA/PAL dates. Officers flag mismatches quickly.'],
                ],
                'reactors' => [0, 1, 4],
            ],
            [
                'author' => 3,
                'hours'  => 36,
                'title'  => 'Retainer scope language for dual intent applications',
                'body'   => "Looking for clean retainer wording that covers temporary + permanent pathways without sounding like a guarantee.\n\nIf you have a clause that survived client questions (and your E&O review), I'd love to see the structure — not the fees.",
                'replies'=> [
                    ['author' => 1, 'hours' => 30, 'body' => 'We separate \"services included\" and \"outcomes not promised\" into two short schedules. Keeps the main agreement readable.'],
                ],
                'reactors' => [0, 2],
            ],
            [
                'author' => 4,
                'hours'  => 52,
                'title'  => 'PNP nomination expired mid-EE — recovery options?',
                'body'   => "Client’s provincial nomination lapsed while EE profile was still open. Province says re-nominate is possible but timeline is tight.\n\nAnyone navigated this recently without starting from scratch?",
                'replies'=> [
                    ['author' => 0, 'hours' => 48, 'body' => 'Yes — escalate with the province first in writing, then update EE docs only after confirmation. Happy to DM details.'],
                    ['author' => 2, 'hours' => 44, 'body' => 'We also prepare a timeline memo for the client so expectations stay realistic during the wait.'],
                    ['author' => 3, 'hours' => 40, 'body' => 'Useful thread. Bookmarking this.'],
                ],
                'reactors' => [0, 1, 2, 3],
            ],
            [
                'author' => 1,
                'hours'  => 70,
                'title'  => 'Client portal tip: document checklist that actually gets used',
                'body'   => "We reduced incomplete uploads by grouping checklist items into Identity / Education / Work / Funds and requiring a note when something is N/A.\n\nSmall UX change, big drop in back-and-forth. What checklist patterns work in your practice?",
                'replies'=> [
                    ['author' => 4, 'hours' => 60, 'body' => 'Love the N/A note idea. We are testing the same on family sponsorship packages.'],
                ],
                'reactors' => [0, 2, 4],
            ],
            [
                'author' => 0,
                'hours'  => 96,
                'title'  => 'CICC CPD — any webinars worth recommending this quarter?',
                'body'   => "Looking for practical CPD (not salesy vendor sessions). Prefer ethics / file management / dual intent topics.\n\nDrop links or titles if something was genuinely useful.",
                'replies'=> [],
                'reactors' => [1, 3, 4],
            ],
            [
                'author' => 2,
                'hours'  => 120,
                'title'  => 'Spousal sponsorship interview prep — what do you rehearse?',
                'body'   => "Besides relationship timeline, we rehearse daily routines, finances, and future plans in both languages when needed.\n\nAny red-flag questions you always include in mock interviews?",
                'replies'=> [
                    ['author' => 0, 'hours' => 110, 'body' => 'We always cover how they met online vs. in person and who paid for trips. Officers dig into that.'],
                    ['author' => 1, 'hours' => 100, 'body' => 'Also family awareness of the relationship — surprisingly common soft spot.'],
                ],
                'reactors' => [0, 1, 3],
            ],
            [
                'author' => 3,
                'hours'  => 150,
                'title'  => 'Welcome — introducing myself to the RCIC Master community',
                'body'   => "Hello colleagues — Marcus here from Calgary. Mostly EE / Alberta Opportunity Stream work.\n\nGlad this space exists. Looking forward to learning from your case experience.",
                'replies'=> [
                    ['author' => 0, 'hours' => 140, 'body' => 'Welcome Marcus! Great to have another Alberta voice here.'],
                    ['author' => 4, 'hours' => 135, 'body' => 'Welcome — feel free to jump into the PNP thread above.'],
                ],
                'reactors' => [0, 2, 4],
            ],
        ];

        $createdPosts = 0;
        $createdReplies = 0;
        $createdReactions = 0;

        foreach ($postsPlan as $plan) {
            $author = $authors[$plan['author'] % $authors->count()];
            $createdAt = now()->subHours($plan['hours']);

            $post = RcicCommunityPost::create([
                'user_id'          => $author->id,
                'title'            => $plan['title'],
                'body'             => $plan['body'],
                'reactions_count'  => 0,
                'replies_count'    => 0,
                'is_hidden'        => false,
            ]);

            $post->forceFill([
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ])->saveQuietly();

            $createdPosts++;

            foreach ($plan['replies'] as $replyPlan) {
                $replyAuthor = $authors[$replyPlan['author'] % $authors->count()];
                $replyAt = now()->subHours($replyPlan['hours']);

                $reply = RcicCommunityReply::create([
                    'post_id'   => $post->id,
                    'user_id'   => $replyAuthor->id,
                    'body'      => $replyPlan['body'],
                    'is_hidden' => false,
                ]);

                $reply->forceFill([
                    'created_at' => $replyAt,
                    'updated_at' => $replyAt,
                ])->saveQuietly();

                $createdReplies++;
            }

            foreach ($plan['reactors'] as $reactorIdx) {
                $reactor = $authors[$reactorIdx % $authors->count()];
                if ($reactor->id === $author->id) {
                    continue;
                }

                RcicCommunityReaction::firstOrCreate(
                    [
                        'post_id' => $post->id,
                        'user_id' => $reactor->id,
                    ],
                    [
                        'reaction' => 'like',
                    ]
                );
                $createdReactions++;
            }

            $post->update([
                'replies_count'   => RcicCommunityReply::where('post_id', $post->id)->where('is_hidden', false)->count(),
                'reactions_count' => RcicCommunityReaction::where('post_id', $post->id)->count(),
            ]);
        }

        $this->command?->info(
            "RCIC Community seeded: {$createdPosts} posts, {$createdReplies} replies, {$createdReactions} reactions."
        );
    }

    private function ensureDemoRcic(
        string $email,
        string $name,
        string $rcicNumber,
        string $company,
        string $city,
    ): User {
        $user = User::firstOrCreate(
            ['email' => $email],
            [
                'name'                 => $name,
                'password'             => Hash::make('Password123!'),
                'phone'                => '+1 416 555 '.random_int(1000, 9999),
                'email_verified_at'    => now(),
                'is_verified'          => true,
                'rcic_number'          => $rcicNumber,
                'is_license_verified'  => true,
                'license_verified_at'  => now()->subMonths(3),
                'company_name'         => $company,
                'company_city'         => $city,
                'company_province'     => 'ON',
                'company_country'      => 'Canada',
                'avatar'               => null,
            ]
        );

        $user->fill([
            'name'                => $name,
            'rcic_number'         => $user->rcic_number ?: $rcicNumber,
            'is_license_verified' => true,
            'company_name'        => $user->company_name ?: $company,
            'company_city'        => $user->company_city ?: $city,
        ])->save();

        if (! $user->hasRole('rcic')) {
            $user->assignRole('rcic');
        }

        return $user->fresh();
    }
}
