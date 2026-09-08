<?php

namespace Tests\Unit\GovernmentForms;

use App\Services\GovernmentForms\SourceDataHasher;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SourceDataHasherTest extends TestCase
{
    #[Test]
    public function it_produces_deterministic_hash_for_same_values(): void
    {
        $hasher = new SourceDataHasher();

        $values = [
            'applicant.personal.family_name' => 'Smith',
            'applicant.personal.given_names' => 'Jane',
        ];

        $this->assertSame($hasher->hash($values), $hasher->hash($values));
    }

    #[Test]
    public function it_normalizes_key_order(): void
    {
        $hasher = new SourceDataHasher();

        $a = ['b' => '2', 'a' => '1'];
        $b = ['a' => '1', 'b' => '2'];

        $this->assertSame($hasher->hash($a), $hasher->hash($b));
    }

    #[Test]
    public function it_trims_string_values(): void
    {
        $hasher = new SourceDataHasher();

        $a = ['applicant.contact.email' => 'test@example.com'];
        $b = ['applicant.contact.email' => '  test@example.com  '];

        $this->assertSame($hasher->hash($a), $hasher->hash($b));
    }

    #[Test]
    public function it_produces_different_hash_for_different_values(): void
    {
        $hasher = new SourceDataHasher();

        $this->assertNotSame(
            $hasher->hash(['applicant.personal.family_name' => 'A']),
            $hasher->hash(['applicant.personal.family_name' => 'B']),
        );
    }
}
