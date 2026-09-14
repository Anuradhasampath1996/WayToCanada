<?php

namespace Tests\Unit;

use App\Services\LegislationCatalogService;
use Tests\TestCase;

class LegislationCatalogIndexParserTest extends TestCase
{
    public function test_parses_justice_canada_act_index_html(): void
    {
        $html = <<<'HTML'
<li><span class="objTitle"><a class="TocTitle" href="I-2.5/index.html">
Immigration and Refugee Protection Act
</a></span>
<a class='rButtonShowRegList' href='I-2.5/index.html#r3lR3g' title='Display the list of regulations'>R</a>
</li>
<li><span class="objTitle"><a class="TocTitle" href="C-29/index.html">
Citizenship Act
</a></span></li>
HTML;

        $found = app(LegislationCatalogService::class)->parseIndexHtml($html);

        $this->assertSame('Immigration and Refugee Protection Act', $found['I-2.5']);
        $this->assertSame('Citizenship Act', $found['C-29']);
        $this->assertArrayNotHasKey('laws-index', $found);
        $this->assertCount(2, $found);
    }

    public function test_parses_regulation_codes_with_commas_and_underscores(): void
    {
        $html = <<<'HTML'
<li><span class="objTitle"><a class="TocTitle" href="SOR-2002-227/index.html">
Immigration and Refugee Protection Regulations
</a></span></li>
<li><span class="objTitle"><a class="TocTitle" href="C.R.C.,_c._1465/index.html">
<span class='Repealed'>Sable Island Regulations [Repealed]</span>
</a></span></li>
HTML;

        $found = app(LegislationCatalogService::class)->parseIndexHtml($html);

        $this->assertSame('Immigration and Refugee Protection Regulations', $found['SOR-2002-227']);
        $this->assertStringContainsString('Sable Island Regulations', $found['C.R.C.,_c._1465']);
    }
}
