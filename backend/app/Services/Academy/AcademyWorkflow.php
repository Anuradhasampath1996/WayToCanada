<?php

namespace App\Services\Academy;

use App\Models\Academy\AcademyContentReview;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class AcademyWorkflow
{
    /** @var list<string> */
    public const STATUSES = ['draft', 'content_review', 'legal_review', 'approved', 'published', 'archived'];

    public function transition(Model $model, string $to, User $actor, ?string $comment = null, bool $override = false): void
    {
        $from = (string) $model->getAttribute('status');
        if ($to === 'published' && $from !== 'approved' && ! $override) {
            abort(422, 'Exam-prep content must be approved before it can be published.');
        }

        if (! in_array($to, self::STATUSES, true)) {
            abort(422, 'Invalid content status.');
        }

        if ($to === 'published' && $from !== 'approved') {
            $override = true;
        }

        $model->setAttribute('status', $to);
        foreach ([
            'reviewed_by' => in_array($to, ['content_review', 'legal_review'], true) ? $actor->id : null,
            'reviewed_at' => in_array($to, ['content_review', 'legal_review'], true) ? now() : null,
            'approved_by' => $to === 'approved' ? $actor->id : null,
            'approved_at' => $to === 'approved' ? now() : null,
            'published_at' => $to === 'published' ? now() : null,
            'published_by' => $to === 'published' ? $actor->id : null,
        ] as $column => $value) {
            if ($value !== null && $this->hasColumn($model, $column)) {
                $model->setAttribute($column, $value);
            }
        }
        $model->save();

        AcademyContentReview::query()->create([
            'reviewable_type' => $model->getMorphClass(),
            'reviewable_id' => $model->getKey(),
            'from_status' => $from,
            'to_status' => $to,
            'actor_user_id' => $actor->id,
            'comment' => $override && $from !== 'approved' && $to === 'published'
                ? trim(($comment ?: '').' [admin override]')
                : $comment,
            'created_at' => now(),
        ]);
    }

    private function hasColumn(Model $model, string $column): bool
    {
        return Schema::connection($model->getConnectionName())->hasColumn($model->getTable(), $column);
    }
}
