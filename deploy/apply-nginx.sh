#!/bin/bash
set -e
rm -f /etc/nginx/sites-enabled/lightersmenia.com
rm -f /etc/nginx/sites-available/lightersmenia.com
cp /opt/waytocanada/deploy/nginx/rcicmaster.conf /etc/nginx/sites-available/rcicmaster.com
ln -sf /etc/nginx/sites-available/rcicmaster.com /etc/nginx/sites-enabled/rcicmaster.com
nginx -t
systemctl reload nginx
