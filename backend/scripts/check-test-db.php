<?php
try {
    new PDO('pgsql:host=127.0.0.1;port=5433;dbname=db_cws_test', 'postgres', 'secret');
    echo "OK db_cws_test\n";
    new PDO('pgsql:host=127.0.0.1;port=5433;dbname=db_lms_test', 'postgres', 'secret');
    echo "OK db_lms_test\n";
} catch (Throwable $e) {
    echo 'FAIL: ' . $e->getMessage() . "\n";
    exit(1);
}
