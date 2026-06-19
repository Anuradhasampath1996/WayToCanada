<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$key = (bool) config('services.openai.key');
$legislation = (bool) config('legislation_sources.openai.enabled');
$maple = (bool) config('workspace_ai.enabled');

echo 'openai_key_set='.($key ? 'yes' : 'no')."\n";
echo 'legislation_openai='.($legislation ? 'enabled' : 'disabled')."\n";
echo 'maple_workspace_ai='.($maple ? 'enabled' : 'disabled')."\n";
echo 'maple_openai_ready='.(($key && $maple) ? 'yes' : 'no')."\n";
echo 'workspace_model='.config('workspace_ai.model')."\n";
