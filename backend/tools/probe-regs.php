<?php
$html = file_get_contents('https://laws-lois.justice.gc.ca/eng/regulations/s.html');
preg_match_all('/href="([A-Za-z0-9\.\-]+)\/index\.html">\s*([^<]+)/', $html, $m, PREG_SET_ORDER);
echo count($m)." regs on S page\n";
foreach (array_slice($m, 0, 5) as $x) {
    echo "  {$x[1]} — ".trim(strip_tags($x[2]))."\n";
}
if (preg_match('/SOR-2002-227/', $html)) echo "IRPR found\n";
