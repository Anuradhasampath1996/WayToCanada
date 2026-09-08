<?php

namespace App\Services\GovernmentForms;

use RuntimeException;

class GovernmentFormGenerationException extends RuntimeException
{
    public static function fromThrowable(\Throwable $e): self
    {
        if ($e instanceof self) {
            return $e;
        }

        $message = $e->getMessage();

        if (str_contains($message, 'Form processor failed') || str_contains($message, 'Processor')) {
            $message = 'Form processor failed. Please try again or contact support.';
        } elseif (self::containsFilesystemPath($message)) {
            $message = 'Form generation failed. Please try again or contact support.';
        }

        return new self($message, (int) $e->getCode(), $e);
    }

    private static function containsFilesystemPath(string $message): bool
    {
        return (bool) preg_match('/([A-Za-z]:\\\\|\\\\|\/storage\/|\/private\/|\/app\/)/', $message);
    }
}
