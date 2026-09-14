<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LearningCoursePayment extends Model
{
    protected $connection = 'cws';

    protected $table = 'learning_course_payments';

    protected $fillable = [
        'learner_user_id', 'product_domain', 'course_id', 'amount_cents', 'currency', 'status',
        'stripe_checkout_session_id', 'stripe_payment_intent_id', 'access_months',
        'entitled_until', 'metadata_json',
    ];

    protected function casts(): array
    {
        return [
            'entitled_until' => 'datetime',
            'metadata_json' => 'array',
        ];
    }
}
