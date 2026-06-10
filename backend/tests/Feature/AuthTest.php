<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    protected string $seeder = RolesAndPermissionsSeeder::class;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_google_redirect_returns_url(): void
    {
        $response = $this->getJson('/api/v1/auth/google/redirect');

        $response->assertOk()
                 ->assertJsonStructure(['redirect_url']);

        $this->assertStringContainsString('accounts.google.com', $response->json('redirect_url'));
    }

    public function test_google_callback_creates_user_and_redirects_with_token(): void
    {
        $fakeGoogleUser = Mockery::mock(SocialiteUser::class);
        $fakeGoogleUser->shouldReceive('getId')->andReturn('google-uid-123');
        $fakeGoogleUser->shouldReceive('getName')->andReturn('Test User');
        $fakeGoogleUser->shouldReceive('getEmail')->andReturn('test@example.com');
        $fakeGoogleUser->shouldReceive('getAvatar')->andReturn('https://avatar.example.com/test.jpg');

        Socialite::shouldReceive('driver->stateless->user')
                 ->andReturn($fakeGoogleUser);

        $response = $this->get('/api/v1/auth/google/callback');

        $response->assertRedirect();
        $this->assertStringContainsString('token=', $response->headers->get('Location') ?? '');
        $this->assertDatabaseHas('users', ['email' => 'test@example.com']);
    }

    public function test_google_callback_returns_existing_user(): void
    {
        $user = User::factory()->create(['google_id' => 'google-uid-456', 'email' => 'existing@example.com']);
        $user->assignRole('client');

        $fakeGoogleUser = Mockery::mock(SocialiteUser::class);
        $fakeGoogleUser->shouldReceive('getId')->andReturn('google-uid-456');
        $fakeGoogleUser->shouldReceive('getName')->andReturn($user->name);
        $fakeGoogleUser->shouldReceive('getEmail')->andReturn($user->email);
        $fakeGoogleUser->shouldReceive('getAvatar')->andReturn(null);

        Socialite::shouldReceive('driver->stateless->user')
                 ->andReturn($fakeGoogleUser);

        $response = $this->get('/api/v1/auth/google/callback');

        $response->assertRedirect();
        $this->assertCount(1, User::where('email', 'existing@example.com')->get());
    }

    public function test_me_returns_authenticated_user(): void
    {
        $user = User::factory()->create();
        $user->assignRole('client');
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->getJson('/api/v1/me');

        $response->assertOk()
                 ->assertJsonPath('email', $user->email)
                 ->assertJsonStructure(['id', 'name', 'email', 'locale', 'roles']);
    }

    public function test_me_rejects_unauthenticated_request(): void
    {
        $this->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_logout_revokes_token(): void
    {
        $user = User::factory()->create();
        $user->assignRole('client');
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/logout')->assertOk();

        $this->assertNull(PersonalAccessToken::findToken($token));
    }
}
