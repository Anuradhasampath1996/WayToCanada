<?php

namespace App\Console\Commands;

use App\Mail\AgreementReminderEmail;
use App\Models\CaseFile;
use App\Services\AgreementReminderService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class SendAgreementReminders extends Command
{
    protected $signature = 'agreements:send-reminders
                            {--days=3 : Days after send before first auto reminder}
                            {--cooldown=48 : Minimum hours between reminders}';

    protected $description = 'Email (and optional WhatsApp via Twilio) reminders for unsigned retainer agreements';

    public function handle(AgreementReminderService $reminders): int
    {
        $days     = (int) $this->option('days');
        $cooldown = (int) $this->option('cooldown');

        $caseFiles = CaseFile::query()
            ->whereNotNull('agreement_sent_at')
            ->whereNull('agreement_signed_at')
            ->where('agreement_sent_at', '<=', now()->subDays($days))
            ->where(function ($q) use ($cooldown) {
                $q->whereNull('agreement_last_reminder_at')
                    ->orWhere('agreement_last_reminder_at', '<=', now()->subHours($cooldown));
            })
            ->with('clientProfile.user', 'consultant')
            ->get();

        $sent = 0;

        foreach ($caseFiles as $caseFile) {
            $profile    = $caseFile->clientProfile;
            $consultant = $caseFile->consultant;

            if (! $profile?->user?->email || ! $consultant) {
                continue;
            }

            Mail::to($profile->user->email)
                ->send(new AgreementReminderEmail($profile, $caseFile, $consultant));

            $phone   = $reminders->resolveClientPhone($profile);
            $structured = $reminders->buildReminderStructured(
                $caseFile,
                $profile->user->name ?? 'Client',
                $consultant,
            );

            if ($phone) {
                $reminders->sendWhatsApp($phone, $structured);
            }

            $caseFile->update([
                'agreement_last_reminder_at' => now(),
                'agreement_reminder_count'   => ((int) $caseFile->agreement_reminder_count) + 1,
            ]);

            $sent++;
        }

        $this->info("Sent {$sent} agreement reminder(s).");

        return self::SUCCESS;
    }
}
