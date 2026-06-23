<?php

namespace App\Services\Email;

use App\Enums\NotificationType;
use App\Support\NotificationUrlBuilder;

class EmailTemplateRegistry
{
    /** @return list<array<string, mixed>> */
    public function all(): array
    {
        return array_merge($this->notificationTemplates(), $this->transactionalTemplates());
    }

    public function find(string $key): ?array
    {
        foreach ($this->all() as $template) {
            if ($template['key'] === $key) {
                return $template;
            }
        }

        return null;
    }

    /** @return list<array<string, mixed>> */
    private function notificationTemplates(): array
    {
        $templates = [];

        foreach (NotificationType::cases() as $type) {
            if (! in_array('email', $type->defaultChannels(), true)) {
                continue;
            }

            $sample = $this->sampleForNotificationType($type);

            foreach ($type->typicalAudiences() as $audience) {
                $templates[] = [
                    'key'              => 'notification.' . $type->value . '.' . $audience,
                    'name'             => $type->label() . ' (' . ucfirst($audience) . ')',
                    'description'      => $sample['description'],
                    'kind'             => 'notification',
                    'audience'         => $audience,
                    'category'         => $type->category(),
                    'notification_type'=> $type->value,
                    'channels'         => $this->channelsForAudience($type, $audience),
                    'view'             => 'emails.generic_notification',
                    'subject_example'  => $sample['title'],
                    'variables'        => [
                        ['name' => 'recipientName', 'description' => 'Recipient first name'],
                        ['name' => 'title', 'description' => 'Email subject and heading'],
                        ['name' => 'body', 'description' => 'Notification message body'],
                        ['name' => 'action_url', 'description' => 'Primary call-to-action link'],
                        ['name' => 'categoryLabel', 'description' => 'Badge label for notification category'],
                    ],
                    'sample'           => array_merge($sample, [
                        'recipient_name' => $this->sampleRecipientName($audience),
                    ]),
                ];
            }
        }

        return $templates;
    }

    /** @return list<string> */
    private function channelsForAudience(NotificationType $type, string $audience): array
    {
        $channels = $type->defaultChannels();

        if (in_array($audience, ['consultant', 'client'], true) && ! in_array('whatsapp', $channels, true)) {
            $channels[] = 'whatsapp';
        }

        return array_values(array_unique($channels));
    }

    /** @return array{title: string, body: string, action_url: string, description: string} */
    private function sampleForNotificationType(NotificationType $type): array
    {
        return match ($type) {
            NotificationType::NEW_MESSAGE => [
                'title'       => 'New message from your consultant',
                'body'        => "Hi Alex, your consultant left a new message in your case workspace:\n\n\"Please upload your passport bio page when you have a moment.\"",
                'action_url'  => NotificationUrlBuilder::clientCaseManagement(),
                'description' => 'Sent when a client or consultant sends a case message.',
            ],
            NotificationType::AGREEMENT_SIGNED => [
                'title'       => 'Retainer agreement signed',
                'body'        => 'Alex Johnson signed the retainer agreement. You can continue with the next workspace steps.',
                'action_url'  => NotificationUrlBuilder::consultantClientWorkspace(1, 'retainer-agreement'),
                'description' => 'Notifies the consultant when a client signs the retainer.',
            ],
            NotificationType::QUESTIONNAIRE_SUBMITTED => [
                'title'       => 'Questionnaire submitted',
                'body'        => 'Alex Johnson submitted their immigration questionnaire for your review.',
                'action_url'  => NotificationUrlBuilder::consultantClientWorkspace(1, 'questionnaire-review'),
                'description' => 'Notifies the consultant when a client completes the questionnaire.',
            ],
            NotificationType::MEETING_CANCELLED => [
                'title'       => 'Video meeting cancelled',
                'body'        => 'Your meeting scheduled for March 15, 2026 at 2:00 PM has been cancelled.',
                'action_url'  => NotificationUrlBuilder::clientCaseManagement(),
                'description' => 'Sent when a scheduled client meeting is cancelled.',
            ],
            NotificationType::PAYMENT_RECEIVED => [
                'title'       => 'Client payment received',
                'body'        => 'Alex Johnson paid $250.00 CAD for "Initial consultation fee".',
                'action_url'  => NotificationUrlBuilder::consultantClientWorkspace(1),
                'description' => 'Notifies the consultant when a client completes a payment request.',
            ],
            NotificationType::DOCUMENT_UPLOADED => [
                'title'       => 'New document uploaded',
                'body'        => 'Alex Johnson uploaded "Passport scan.pdf" to their case file.',
                'action_url'  => NotificationUrlBuilder::consultantClientDocuments(1),
                'description' => 'Notifies the consultant when a client uploads a document.',
            ],
            NotificationType::DOCUMENT_REVIEWED => [
                'title'       => 'Document reviewed',
                'body'        => 'Your consultant reviewed "Passport scan.pdf". Status: Approved.',
                'action_url'  => NotificationUrlBuilder::clientCaseManagement(),
                'description' => 'Notifies the client when a document is reviewed.',
            ],
            NotificationType::CASE_STATUS_CHANGED => [
                'title'       => 'Case status updated',
                'body'        => 'Your immigration case status changed to "In progress".',
                'action_url'  => NotificationUrlBuilder::clientCaseManagement(),
                'description' => 'Sent when a case file status changes.',
            ],
            NotificationType::COURSE_ASSIGNED => [
                'title'       => 'New learning course assigned',
                'body'        => 'Your consultant assigned "RCIC Entry-to-Practice Exam Prep" for you to complete.',
                'action_url'  => rtrim(env('PUBLIC_DASHBOARD_URL', 'http://localhost:3002'), '/') . '/user-dashboard/learning',
                'description' => 'Notifies the client when a consultant assigns an LMS course.',
            ],
            NotificationType::LMS_COMPLETED => [
                'title'       => 'Course completed',
                'body'        => 'Alex Johnson completed "RCIC Entry-to-Practice Exam Prep".',
                'action_url'  => NotificationUrlBuilder::consultantClientWorkspace(1),
                'description' => 'Notifies the consultant when a client finishes a course.',
            ],
            NotificationType::ADMIN_BROADCAST => [
                'title'       => 'Platform update from RCICMASTER',
                'body'        => "We've improved the billing dashboard and added new marketing service checkout options. Sign in to explore the updates.",
                'action_url'  => rtrim(env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/') . '/dashboard',
                'description' => 'Admin broadcast to consultants (in-app + email).',
            ],
            NotificationType::SYSTEM_ALERT => [
                'title'       => 'System alert',
                'body'        => 'A system event requires your attention. Please review your dashboard.',
                'action_url'  => rtrim(env('ADMIN_DASHBOARD_URL', 'http://localhost:3001'), '/') . '/admindashboard',
                'description' => 'Critical platform alerts for admins or consultants.',
            ],
            NotificationType::SUPPORT_TICKET_CREATED => [
                'title'       => 'New consultant support request',
                'body'        => 'Jane RCIC (Bug): Payment checkout shows wrong tax amount for Ontario clients.',
                'action_url'  => NotificationUrlBuilder::adminSupportTickets(1),
                'description' => 'Notifies admins when a consultant opens a support ticket.',
            ],
            NotificationType::SUPPORT_TICKET_REPLY => [
                'title'       => 'Reply on your support request',
                'body'        => "Support team replied on \"Payment checkout issue\": We've deployed a fix — please hard-refresh and try again.",
                'action_url'  => NotificationUrlBuilder::consultantSupportTickets(1),
                'description' => 'Notifies admin or consultant when a support ticket receives a reply.',
            ],
            NotificationType::SUPPORT_TICKET_CLOSED => [
                'title'       => 'Support request closed',
                'body'        => 'Your request "Payment checkout issue" has been marked as resolved.',
                'action_url'  => NotificationUrlBuilder::consultantSupportTickets(1),
                'description' => 'Notifies the consultant when a support ticket is closed.',
            ],
            NotificationType::CLIENT_CONSULTANT_REQUEST => [
                'title'       => 'New client connection request',
                'body'        => 'Alex Johnson would like to connect with you as their immigration consultant.',
                'action_url'  => rtrim(env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/') . '/dashboard/clients',
                'description' => 'Notifies a consultant when a public user requests to connect.',
            ],
            NotificationType::CLIENT_CONSULTANT_REQUEST_ACCEPTED => [
                'title'       => 'Consultant accepted your request',
                'body'        => 'Jane RCIC accepted your connection request. You can now complete your questionnaire.',
                'action_url'  => rtrim(env('PUBLIC_DASHBOARD_URL', 'http://localhost:3002'), '/') . '/user-dashboard',
                'description' => 'Notifies the client when a consultant accepts their request.',
            ],
            NotificationType::CLIENT_CONSULTANT_REQUEST_DECLINED => [
                'title'       => 'Consultant declined your request',
                'body'        => 'Jane RCIC is unable to take new clients at this time. You may choose another consultant.',
                'action_url'  => rtrim(env('PUBLIC_DASHBOARD_URL', 'http://localhost:3002'), '/') . '/user-dashboard/choose-consultant',
                'description' => 'Notifies the client when a consultant declines their request.',
            ],
            default => [
                'title'       => $type->label(),
                'body'        => 'Sample notification body for ' . $type->label() . '.',
                'action_url'  => rtrim(env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/') . '/dashboard',
                'description' => 'System notification email.',
            ],
        };
    }

    private function sampleRecipientName(string $audience): string
    {
        return match ($audience) {
            'admin'      => 'Admin User',
            'consultant' => 'Jane RCIC',
            'client'     => 'Alex Johnson',
            default      => 'User',
        };
    }

    /** @return list<array<string, mixed>> */
    private function transactionalTemplates(): array
    {
        $consultantUrl = rtrim(env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/');
        $publicUrl     = rtrim(env('PUBLIC_DASHBOARD_URL', 'http://localhost:3002'), '/');

        return [
            [
                'key'             => 'transactional.retainer_agreement',
                'name'            => 'Retainer agreement invitation',
                'description'     => 'Sent to the client when the consultant shares a retainer agreement to sign.',
                'kind'            => 'transactional',
                'audience'        => 'client',
                'category'        => 'agreements',
                'channels'        => ['email'],
                'view'            => 'emails.retainer_agreement',
                'subject_example' => 'Your Retainer Agreement — RCICMASTER',
                'variables'       => [
                    ['name' => 'clientName', 'description' => 'Client full name'],
                    ['name' => 'consultantName', 'description' => 'Consultant name'],
                    ['name' => 'pathway', 'description' => 'Immigration pathway'],
                    ['name' => 'agreementUrl', 'description' => 'Secure signing link'],
                ],
                'sample'          => [
                    'clientName'     => 'Alex Johnson',
                    'consultantName' => 'Jane RCIC',
                    'pathway'        => 'Express Entry',
                    'agreementUrl'   => $publicUrl . '/agreement/sample-token',
                    'recipient_name' => 'Alex Johnson',
                ],
            ],
            [
                'key'             => 'transactional.agreement_signed',
                'name'            => 'Agreement signed (consultant)',
                'description'     => 'Direct email to consultant when client signs (in addition to in-app notification).',
                'kind'            => 'transactional',
                'audience'        => 'consultant',
                'category'        => 'agreements',
                'channels'        => ['email'],
                'view'            => 'emails.agreement_signed',
                'subject_example' => 'Client Signed Retainer Agreement — Alex Johnson',
                'variables'       => [
                    ['name' => 'clientName', 'description' => 'Client name'],
                    ['name' => 'consultantName', 'description' => 'Consultant name'],
                    ['name' => 'workspaceUrl', 'description' => 'Link to client workspace'],
                ],
                'sample'          => [
                    'clientName'     => 'Alex Johnson',
                    'consultantName' => 'Jane RCIC',
                    'pathway'        => 'Express Entry',
                    'signedAt'       => now()->format('F j, Y g:i A'),
                    'signedVia'      => 'digital_signature',
                    'workspaceUrl'   => $consultantUrl . '/dashboard/clients/1/workspace',
                    'recipient_name' => 'Jane RCIC',
                ],
            ],
            [
                'key'             => 'transactional.agreement_reminder',
                'name'            => 'Agreement signing reminder',
                'description'     => 'Reminder email when a retainer agreement remains unsigned.',
                'kind'            => 'transactional',
                'audience'        => 'client',
                'category'        => 'agreements',
                'channels'        => ['email'],
                'view'            => 'emails.agreement_reminder',
                'subject_example' => 'Reminder: Please sign your retainer agreement',
                'variables'       => [
                    ['name' => 'clientName', 'description' => 'Client name'],
                    ['name' => 'agreementUrl', 'description' => 'Signing link'],
                ],
                'sample'          => [
                    'clientName'     => 'Alex Johnson',
                    'consultantName' => 'Jane RCIC',
                    'agreementUrl'   => $publicUrl . '/agreement/sample-token',
                    'sentAt'         => now()->subDays(3)->format('F j, Y'),
                    'recipient_name' => 'Alex Johnson',
                ],
            ],
            [
                'key'             => 'transactional.client_payment_request',
                'name'            => 'Client payment request',
                'description'     => 'Payment link email sent to clients for consultant-collected fees.',
                'kind'            => 'transactional',
                'audience'        => 'client',
                'category'        => 'payments',
                'channels'        => ['email'],
                'view'            => 'emails.client_payment_request',
                'subject_example' => 'Payment request from Jane RCIC Immigration',
                'variables'       => [
                    ['name' => 'title', 'description' => 'Payment title'],
                    ['name' => 'amount', 'description' => 'Amount due'],
                    ['name' => 'payUrl', 'description' => 'Secure payment link'],
                ],
                'sample'          => [
                    'clientName'     => 'Alex Johnson',
                    'consultantName' => 'Jane RCIC',
                    'companyName'    => 'Jane RCIC Immigration',
                    'title'          => 'Initial consultation fee',
                    'amount'         => '250.00',
                    'currency'       => 'CAD',
                    'description'    => 'Covers your first strategy session and document review.',
                    'payUrl'         => $publicUrl . '/pay/sample-token',
                    'recipient_name' => 'Alex Johnson',
                ],
            ],
            [
                'key'             => 'transactional.client_meeting_invite',
                'name'            => 'Meeting invitation',
                'description'     => 'Video meeting invite with date, time, and join link.',
                'kind'            => 'transactional',
                'audience'        => 'client',
                'category'        => 'meetings',
                'channels'        => ['email'],
                'view'            => 'emails.client_meeting_invite',
                'subject_example' => 'Meeting invitation — Strategy call',
                'variables'       => [
                    ['name' => 'meetingTitle', 'description' => 'Meeting title'],
                    ['name' => 'joinUrl', 'description' => 'Join link'],
                ],
                'sample'          => [
                    'clientName'     => 'Alex Johnson',
                    'consultantName' => 'Jane RCIC',
                    'companyName'    => 'Jane RCIC Immigration',
                    'title'          => 'Express Entry strategy call',
                    'when'           => 'March 15, 2026 at 2:00 PM EST',
                    'duration'       => 60,
                    'provider'       => 'Zoom',
                    'description'    => 'Please have your passport and language test results ready.',
                    'inviteUrl'      => $publicUrl . '/meeting/sample-token',
                    'meetingUrl'     => 'https://zoom.us/j/sample',
                    'recipient_name' => 'Alex Johnson',
                ],
            ],
            [
                'key'             => 'transactional.client_invitation',
                'name'            => 'Client account invitation',
                'description'     => 'Invite email when a consultant adds a new client to the platform.',
                'kind'            => 'transactional',
                'audience'        => 'client',
                'category'        => 'onboarding',
                'channels'        => ['email'],
                'view'            => 'emails.client-invitation',
                'subject_example' => 'You have been invited to RCICMASTER',
                'variables'       => [
                    ['name' => 'clientName', 'description' => 'Client name'],
                    ['name' => 'loginUrl', 'description' => 'Login / setup link'],
                ],
                'sample'          => [
                    'client'         => (object) ['name' => 'Alex Johnson', 'email' => 'alex@example.com'],
                    'consultant'     => (object) ['name' => 'Jane RCIC'],
                    'password'       => 'TempPass123!',
                    'loginUrl'       => $publicUrl . '/auth/login',
                    'recipient_name' => 'Alex Johnson',
                ],
            ],
            [
                'key'             => 'transactional.rcic_license_verify',
                'name'            => 'RCIC license verification',
                'description'     => 'Email verification during consultant registration.',
                'kind'            => 'transactional',
                'audience'        => 'consultant',
                'category'        => 'onboarding',
                'channels'        => ['email'],
                'view'            => 'emails.rcic_license_verify',
                'subject_example' => 'Verify your RCIC registration — RCICMASTER',
                'variables'       => [
                    ['name' => 'verifyUrl', 'description' => 'Verification link'],
                ],
                'sample'          => [
                    'applicant'      => (object) ['name' => 'Jane RCIC', 'email' => 'jane@example.com'],
                    'rcicNumber'     => 'R123456',
                    'verificationUrl'=> $consultantUrl . '/auth/verify/sample',
                    'recipient_name' => 'Jane RCIC',
                ],
            ],
        ];
    }
}
