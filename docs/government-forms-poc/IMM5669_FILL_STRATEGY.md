# IMM 5669 fill strategy

Last updated: 2026-09-08

## Problem (resolved)

Official IMM 5669 ships **without** a named XFA `datasets` packet. iText
`XfaForm.write` only persists datasets when **both** `template` and `datasets`
slots exist in the `/XFA` PdfArray.

## Fix

`ItextPocMain.fillXfaDatasets` now calls `ensureDatasetsPacket()`:

1. If `/XFA` array lacks `datasets`, insert an empty datasets stream (after
   `template`, before `localeSet`).
2. Rebuild `XfaForm`, then `fillXfaForm` + `write` as usual (append mode).

PoC gate (2026-09-08): synthetic `TESTFAMILY` / `TESTGIVEN` present in output
datasets (`datasets_packet_injected: true`).

## Product

- `IMM5669` is in `supported_forms` with C1 mappings (name, DOB, parents).
- Skeleton: `form-processor-poc/fixtures/imm5669_datasets_skeleton.xml`
- Background/travel grids remain for later mapping expansion.
