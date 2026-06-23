<?php

namespace App\Support;

class NotificationUrlBuilder
{
    public static function consultantClientWorkspace(int $profileId, ?string $section = null): string
    {
        $base = rtrim((string) env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/')
            . "/dashboard/clients/{$profileId}/workspace";

        return $section ? $base . '/' . ltrim($section, '/') : $base;
    }

    public static function clientCaseManagement(): string
    {
        return rtrim((string) env('PUBLIC_DASHBOARD_URL', 'http://localhost:3002'), '/')
            . '/user-dashboard/case-management';
    }

    public static function clientRetainerAgreement(): string
    {
        return rtrim((string) env('PUBLIC_DASHBOARD_URL', 'http://localhost:3002'), '/')
            . '/user-dashboard/retainer-agreement';
    }

    public static function clientQuestionnaire(): string
    {
        return rtrim((string) env('PUBLIC_DASHBOARD_URL', 'http://localhost:3002'), '/')
            . '/user-dashboard/questionnaire';
    }

    public static function publicMeeting(string $token): string
    {
        return rtrim((string) env('PUBLIC_DASHBOARD_URL', 'http://localhost:3002'), '/')
            . '/meet/' . $token;
    }

    public static function publicPayment(string $token): string
    {
        return rtrim((string) env('PUBLIC_DASHBOARD_URL', 'http://localhost:3002'), '/')
            . '/pay/' . $token;
    }

    public static function adminLegislationsHub(): string
    {
        return rtrim((string) env('ADMIN_DASHBOARD_URL', 'http://localhost:3001'), '/')
            . '/admindashboard/legislations-hub';
    }

    public static function adminDashboard(): string
    {
        return rtrim((string) env('ADMIN_DASHBOARD_URL', 'http://localhost:3001'), '/')
            . '/dashboard/admindashboard';
    }

    public static function clientLearning(?int $assignmentId = null): string
    {
        $base = rtrim((string) env('PUBLIC_DASHBOARD_URL', 'http://localhost:3002'), '/')
            . '/user-dashboard/learning';

        return $assignmentId ? "{$base}/{$assignmentId}" : $base;
    }

    public static function consultantClientLms(int $profileId): string
    {
        return self::consultantClientWorkspace($profileId, 'lms');
    }

    public static function consultantClientDocuments(int $profileId): string
    {
        return self::consultantClientWorkspace($profileId, 'case-management');
    }

    public static function consultantRcicCommunity(?int $postId = null): string
    {
        $base = rtrim((string) env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/')
            . '/dashboard/rcic-community';

        return $postId ? $base . '?post=' . $postId : $base;
    }

    public static function adminRcicCommunity(?string $tab = null): string
    {
        $base = rtrim((string) env('ADMIN_DASHBOARD_URL', 'http://localhost:3001'), '/')
            . '/admindashboard/rcic-community';

        return $tab ? $base . '?tab=' . $tab : $base;
    }

    public static function consultantSupportTickets(?int $ticketId = null): string
    {
        $base = rtrim((string) env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/')
            . '/dashboard';

        return $ticketId ? $base . '?support=' . $ticketId : $base . '?support=1';
    }

    public static function consultantClientRequests(?int $requestId = null): string
    {
        $base = rtrim((string) env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/')
            . '/dashboard/client-requests';

        return $requestId ? $base . '?request=' . $requestId : $base;
    }

    public static function clientDashboard(): string
    {
        return rtrim((string) env('PUBLIC_DASHBOARD_URL', 'http://localhost:3002'), '/')
            . '/user-dashboard';
    }

    public static function clientChooseConsultant(): string
    {
        return rtrim((string) env('PUBLIC_DASHBOARD_URL', 'http://localhost:3002'), '/')
            . '/user-dashboard/choose-consultant';
    }

    public static function adminSupportTickets(?int $ticketId = null): string
    {
        $base = rtrim((string) env('ADMIN_DASHBOARD_URL', 'http://localhost:3001'), '/')
            . '/admindashboard/support-tickets';

        return $ticketId ? $base . '?ticket=' . $ticketId : $base;
    }

    public static function consultantBilling(): string
    {
        return rtrim((string) env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/')
            . '/dashboard/billing';
    }
}
