<?php

namespace Database\Seeders;

use App\Models\MarketingService;
use Illuminate\Database\Seeder;

class MarketingServiceSeeder extends Seeder
{
    public function run(): void
    {
        $services = [
            [
                'slug'         => 'website-builder',
                'name'         => 'Website Builder',
                'tagline'      => 'Professional RCIC website built for you',
                'summary'      => 'Get a polished consultant website with your branding, services, and contact details — built and hosted through WayToCanada.',
                'detail_body'  => "We design and launch a professional website that represents your RCIC practice.\n\nWhat's included:\n• Custom pages for your services, about you, and contact\n• Mobile-friendly modern design aligned with your brand\n• Basic SEO setup so clients can find you online\n• Integration with your WayToCanada consultant profile\n\nAfter payment, our team contacts you within 2 business days to gather your logo, colours, and content preferences.",
                'features'     => [
                    'Custom RCIC-branded website',
                    'Mobile responsive design',
                    'Contact & consultation request forms',
                    'SEO-ready structure',
                    'WayToCanada team builds it for you',
                ],
                'price'        => 499.00,
                'price_label'  => 'one-time',
                'billing_type' => MarketingService::BILLING_ONE_TIME,
                'sort_order'   => 1,
            ],
            [
                'slug'         => 'social-media',
                'name'         => 'Social Media Management',
                'tagline'      => 'Grow your practice on social platforms',
                'summary'      => 'Let our team manage your social media presence — content planning, posting, and engagement on the platforms you choose.',
                'detail_body'  => "Focus on your clients while we handle your social media.\n\nWhat's included:\n• Platform setup and profile optimization (Facebook, Instagram, LinkedIn)\n• Monthly content calendar tailored to immigration consulting\n• Scheduled posts and basic community engagement\n• Monthly performance summary\n\nTell us which platforms matter most to your practice. We onboard you after payment and agree on tone, frequency, and approval workflow.",
                'features'     => [
                    'Facebook, Instagram & LinkedIn support',
                    'Monthly content calendar',
                    'Scheduled posts & captions',
                    'Profile optimization',
                    'Monthly performance report',
                ],
                'price'        => 199.00,
                'price_label'  => 'per month',
                'billing_type' => MarketingService::BILLING_MONTHLY,
                'sort_order'   => 2,
            ],
            [
                'slug'         => 'google-ads',
                'name'         => 'Google Ads Campaigns',
                'tagline'      => 'Reach clients searching for immigration help',
                'summary'      => 'Run targeted Google Ads campaigns managed by our marketing team to bring qualified leads to your practice.',
                'detail_body'  => "Get in front of people actively searching for immigration consultants in your area.\n\nWhat's included:\n• Campaign strategy and keyword research for your services\n• Ad copy and landing page recommendations\n• Campaign setup, monitoring, and optimization\n• Monthly spend and leads report (ad spend billed separately by Google)\n\nService fee covers management. You set your Google Ads budget directly with Google. We configure campaigns after onboarding.",
                'features'     => [
                    'Keyword research for RCIC services',
                    'Campaign setup & optimization',
                    'Ad copy written for your practice',
                    'Monthly performance reporting',
                    'Dedicated campaign manager',
                ],
                'price'        => 299.00,
                'price_label'  => 'per month',
                'billing_type' => MarketingService::BILLING_MONTHLY,
                'sort_order'   => 3,
            ],
        ];

        foreach ($services as $service) {
            MarketingService::updateOrCreate(
                ['slug' => $service['slug']],
                array_merge($service, ['is_active' => true]),
            );
        }
    }
}
