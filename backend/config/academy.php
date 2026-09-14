<?php

return [
    'media_disk' => env('ACADEMY_MEDIA_DISK', 'local'),
    'thumbnail_disk' => env('ACADEMY_THUMBNAIL_DISK', 'public'),
    'practice_max_questions' => 100,
    'weak_topic_threshold' => 70,
    'weak_topic_min_attempts' => 5,
    'discrimination_min_sample' => 20,
    'readiness_weights' => [
        'course_completion' => 0.25,
        'independent_mcq' => 0.25,
        'case_based' => 0.25,
        'mock' => 0.25,
    ],
    'content_statuses' => [
        'draft',
        'content_review',
        'legal_review',
        'approved',
        'published',
        'archived',
    ],
    'publish_from' => 'approved',
    'disclaimer' => 'RCIC Academy is an independent professional learning and exam-preparation program. Content is a study aid, not official CICC exam material, not legal advice, and not an official pass prediction. Always verify the linked official source.',
];
