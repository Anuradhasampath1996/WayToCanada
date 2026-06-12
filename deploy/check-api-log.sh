#!/bin/bash
sudo -u github-actions docker exec wtc_api sh -c 'tail -30 storage/logs/laravel.log 2>/dev/null || ls -la storage/logs/'
