#!/bin/bash
sudo -u github-actions docker exec wtc_api sh -c 'grep -A2 "InvalidArgumentException\|ERROR\|local.ERROR" storage/logs/laravel.log | tail -20'
