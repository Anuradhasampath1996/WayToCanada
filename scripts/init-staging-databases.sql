-- Isolated staging DBs only. Never create or drop db_cws / db_lms / db_legal.
SELECT 'CREATE DATABASE db_lms_staging'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'db_lms_staging')\gexec
SELECT 'CREATE DATABASE db_legal_staging'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'db_legal_staging')\gexec
