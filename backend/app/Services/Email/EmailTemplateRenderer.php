<?php

namespace App\Services\Email;

use App\Enums\NotificationType;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\Notifications\WhatsAppMessageBuilder;
use Illuminate\Support\Facades\View;

class EmailTemplateRenderer
{
    public function __construct(
        private EmailTemplateRegistry $registry,
        private EmailBrandingService $branding,
        private WhatsAppMessageBuilder $whatsappMessages,
    ) {}

    /** @return list<array<string, mixed>> */
    public function listForAdmin(): array
    {
        return collect($this->registry->all())
            ->map(fn (array $template) => [
                'key'             => $template['key'],
                'name'            => $template['name'],
                'description'     => $template['description'],
                'kind'            => $template['kind'],
                'audience'        => $template['audience'],
                'category'        => $template['category'],
                'channels'        => $template['channels'],
                'subject_example' => $template['subject_example'],
                'notification_type'=> $template['notification_type'] ?? null,
                'variables'       => $template['variables'],
            ])
            ->values()
            ->all();
    }

    /** @return array{email_html: string, whatsapp_text: string|null, has_whatsapp: bool} */
    public function renderPreviewBundle(string $key): array
    {
        $template = $this->registry->find($key);
        if (! $template) {
            abort(404, 'Email template not found.');
        }

        $hasWhatsApp = in_array('whatsapp', $template['channels'] ?? [], true);

        return [
            'email_html'     => $this->renderPreview($key),
            'whatsapp_text'  => $hasWhatsApp ? $this->renderWhatsAppPreview($template) : null,
            'has_whatsapp'   => $hasWhatsApp,
        ];
    }

    public function renderPreview(string $key): string
    {
        $template = $this->registry->find($key);
        if (! $template) {
            abort(404, 'Email template not found.');
        }

        return $this->renderEmailPreview($template);
    }

    /** @param array<string, mixed> $template */
    private function renderEmailPreview(array $template): string
    {
        $recipientName = $template['sample']['recipient_name'] ?? 'User';
        $branding      = $this->branding->viewData($recipientName);

        if ($template['kind'] === 'notification') {
            $type = NotificationType::from($template['notification_type']);
            $notification = new UserNotification([
                'type'       => $type->value,
                'title'      => $template['sample']['title'],
                'body'       => $template['sample']['body'],
                'action_url' => $template['sample']['action_url'],
            ]);

            return View::make($template['view'], array_merge($branding, [
                'emailSubject'  => $notification->title,
                'notification'  => $notification,
                'categoryLabel' => $type->categoryLabel(),
                'actionLabel'   => $type->emailActionLabel(),
            ]))->render();
        }

        $sample = $template['sample'];
        unset($sample['recipient_name']);

        return View::make($template['view'], array_merge($branding, $sample, [
            'emailSubject' => $template['subject_example'],
        ]))->render();
    }

    /** @param array<string, mixed> $template */
    private function renderWhatsAppPreview(array $template): string
    {
        $sample        = $template['sample'];
        $recipientName = $sample['recipient_name'] ?? 'User';
        $title         = $sample['title'] ?? $template['subject_example'];
        $body          = $sample['body'] ?? '';
        $actionUrl     = $sample['action_url'] ?? null;
        $audience      = $template['audience'] ?? 'consultant';

        if ($audience === 'client') {
            return $this->whatsappMessages->buildForClient(
                $recipientName,
                $this->sampleConsultant(),
                $title,
                $body,
                $actionUrl,
            );
        }

        return $this->whatsappMessages->buildForConsultant(
            $recipientName,
            $title,
            $body,
            $actionUrl,
        );
    }

    private function sampleConsultant(): User
    {
        return new User([
            'name'         => 'Sarah Chen',
            'company_name' => 'Chen Immigration Services',
        ]);
    }
}
