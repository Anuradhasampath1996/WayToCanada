FROM php:8.2-cli

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl libpng-dev libonig-dev libxml2-dev libzip-dev zip unzip libpq-dev \
    openjdk-17-jre-headless \
    && docker-php-ext-install pdo_pgsql pgsql mbstring exif pcntl bcmath gd zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

# Install PHP deps without bootstrapping Laravel during the image build
COPY backend/composer.json backend/composer.lock ./
RUN COMPOSER_MEMORY_LIMIT=-1 composer install \
    --no-dev \
    --no-interaction \
    --no-scripts \
    --no-autoloader \
    --prefer-dist

COPY backend/ .
RUN COMPOSER_MEMORY_LIMIT=-1 composer dump-autoload --optimize --no-dev --no-scripts

# Official autofill PDF processor (Java) + XFA dataset fixtures
COPY docker/php/form-processor/ /var/www/form-processor/
# Keep monorepo-relative fixtures available for any hardcoded fallbacks
COPY form-processor-poc/fixtures/ /var/www/form-processor/fixtures/
ENV GOVERNMENT_FORM_PROCESSOR_JAR=/var/www/form-processor/government-form-poc-itext-0.1.0-SNAPSHOT.jar \
    GOVERNMENT_FORM_PROCESSOR_JAVA=java \
    GOVERNMENT_FORM_PROCESSOR_DRIVER=jar

RUN test -f /var/www/form-processor/government-form-poc-itext-0.1.0-SNAPSHOT.jar \
    && java -version \
    && mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache form-processor

COPY docker/php/uploads.ini /usr/local/etc/php/conf.d/uploads.ini
COPY docker/php/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
