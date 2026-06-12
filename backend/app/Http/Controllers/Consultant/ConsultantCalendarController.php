<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Services\Meetings\ConsultantCalendarService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantCalendarController extends Controller
{
    public function __construct(
        private ConsultantCalendarService $calendar,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from'     => 'required|date',
            'to'       => 'required|date|after:from',
            'timezone' => 'nullable|string|max:64',
        ]);

        $timezone = $data['timezone'] ?? 'America/Toronto';
        $from     = Carbon::parse($data['from'], $timezone);
        $to       = Carbon::parse($data['to'], $timezone);

        return response()->json(
            $this->calendar->getEvents($request->user(), $from, $to, $timezone)
        );
    }
}
