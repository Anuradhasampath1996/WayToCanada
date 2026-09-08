-- Created automatically on first container start.
SELECT 'CREATE DATABASE db_lms_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'db_lms_test')\gexec
