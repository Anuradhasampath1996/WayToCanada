package com.rcicmaster.governmentforms;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.itextpdf.forms.PdfAcroForm;
import com.itextpdf.forms.fields.PdfFormField;
import com.itextpdf.forms.xfa.XfaForm;
import com.itextpdf.kernel.pdf.PdfArray;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfName;
import com.itextpdf.kernel.pdf.PdfObject;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.PdfStream;
import com.itextpdf.kernel.pdf.PdfString;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.pdf.ReaderProperties;
import com.itextpdf.kernel.pdf.StampingProperties;
import com.itextpdf.licensing.base.LicenseKey;
import com.itextpdf.tool.xml.xtra.xfa.XFAFlattener;
import com.itextpdf.tool.xml.xtra.xfa.XFAFlattenerProperties;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ItextPocMain {
    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Usage: ItextPocMain <inspect|fill|fill-xfa-datasets|flatten-xfa|compare> ...");
            System.exit(1);
        }
        loadItextLicenseIfConfigured();
        switch (args[0]) {
            case "inspect" -> inspect(Path.of(args[1]), args.length > 2 ? Path.of(args[2]) : null);
            case "fill" -> fill(Path.of(args[1]), Path.of(args[2]), parseFieldArgs(args, 3), false);
            case "fill-with-appearances" -> fill(Path.of(args[1]), Path.of(args[2]), parseFieldArgs(args, 3), true);
            case "fill-xfa-datasets" -> fillXfaDatasets(Path.of(args[1]), Path.of(args[2]), Path.of(args[3]), args.length > 4 && "append".equals(args[4]));
            case "flatten-xfa" -> flattenXfa(Path.of(args[1]), Path.of(args[2]));
            case "compare" -> compare(Path.of(args[1]), Path.of(args[2]), args.length > 3 ? Path.of(args[3]) : null);
            default -> throw new IllegalArgumentException("Unknown command: " + args[0]);
        }
    }

    /**
     * pdfXFA flatten requires a trial/commercial JSON license.
     * Set ITEXT_LICENSE_FILE to the absolute path of itextkey.json (or place
     * form-processor-poc/java-itext/itextkey.json).
     */
    private static void loadItextLicenseIfConfigured() {
        String configured = System.getenv("ITEXT_LICENSE_FILE");
        Path[] candidates = new Path[] {
                configured != null && !configured.isBlank() ? Path.of(configured) : null,
                Path.of("itextkey.json"),
                Path.of("form-processor-poc/java-itext/itextkey.json"),
        };
        for (Path candidate : candidates) {
            if (candidate == null) {
                continue;
            }
            File file = candidate.toFile();
            if (!file.isFile()) {
                continue;
            }
            try {
                LicenseKey.loadLicenseFile(file);
                System.err.println("Loaded iText license from " + file.getAbsolutePath());
                return;
            } catch (Exception e) {
                throw new IllegalStateException("Failed to load iText license from " + file.getAbsolutePath() + ": " + e.getMessage(), e);
            }
        }
    }

    private static PdfReader openReader(Path template) throws java.io.IOException {
        PdfReader reader = new PdfReader(template.toString(), new ReaderProperties().setPassword("".getBytes(StandardCharsets.UTF_8)));
        reader.setUnethicalReading(true);
        return reader;
    }

    private static void inspect(Path template, Path reportOut) throws Exception {
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("engine", "itext");
        report.put("file", template.toString());
        report.put("sha256", sha256(template));
        report.put("byte_size", Files.size(template));

        try (PdfReader reader = openReader(template);
             PdfDocument pdf = new PdfDocument(reader)) {
            report.put("pdf_version", pdf.getPdfVersion().toString());
            report.put("page_count", pdf.getNumberOfPages());
            report.put("encrypted", reader.isEncrypted());

            XfaForm xfa = new XfaForm(pdf);
            report.put("xfa_present", xfa.isXfaPresent());

            PdfAcroForm acro = PdfAcroForm.getAcroForm(pdf, false);
            List<Map<String, Object>> acroFields = new ArrayList<>();
            if (acro != null) {
                Map<String, PdfFormField> allFields = acro.getAllFormFields();
                for (Map.Entry<String, PdfFormField> entry : allFields.entrySet()) {
                    PdfFormField field = entry.getValue();
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("name", entry.getKey());
                    row.put("type", field.getFormType() != null ? field.getFormType().toString() : null);
                    row.put("value", field.getValueAsString());
                    acroFields.add(row);
                }
            }
            report.put("acroform_field_count", acroFields.size());
            report.put("form_technology", xfa.isXfaPresent() ? "xfa" : (acroFields.isEmpty() ? "unknown" : "acroform"));
            report.put("acroform_fields_sample", acroFields.stream().limit(50).toList());
            report.put("all_acroform_field_names", acroFields.stream().map(r -> (String) r.get("name")).toList());
        }

        writeJson(report, reportOut);
    }

    private static void fill(Path template, Path output, Map<String, String> values, boolean regenerateAppearances) throws Exception {
        Files.createDirectories(output.getParent());
        List<String> written = new ArrayList<>();
        List<String> missing = new ArrayList<>();
        List<String> appearanceRegenerated = new ArrayList<>();
        List<String> appearanceFailed = new ArrayList<>();

        try (PdfReader reader = openReader(template);
             PdfWriter writer = new PdfWriter(output.toString());
             PdfDocument pdf = new PdfDocument(reader, writer)) {

            PdfAcroForm acro = PdfAcroForm.getAcroForm(pdf, true);
            if (regenerateAppearances) {
                acro.setGenerateAppearance(true);
            }
            for (Map.Entry<String, String> entry : values.entrySet()) {
                PdfFormField field = acro.getField(entry.getKey());
                if (field != null) {
                    field.setValue(entry.getValue());
                    written.add(entry.getKey());
                    if (regenerateAppearances) {
                        boolean ok = field.regenerateField();
                        if (ok) {
                            appearanceRegenerated.add(entry.getKey());
                        } else {
                            appearanceFailed.add(entry.getKey());
                        }
                    }
                } else {
                    missing.add(entry.getKey());
                }
            }
            // Do NOT flatten — preserve editable AcroForm structure.
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("engine", regenerateAppearances ? "itext-core-with-ap-regen" : "itext-core-acroform");
        result.put("output", output.toString());
        result.put("flattened", false);
        result.put("written_fields", written);
        result.put("missing_fields", missing);
        if (regenerateAppearances) {
            result.put("appearance_regenerated", appearanceRegenerated);
            result.put("appearance_failed", appearanceFailed);
        }
        writeJson(result, null);
    }

    private static final byte[] EMPTY_DATASETS_PACKET = (
            "<xfa:datasets xmlns:xfa=\"http://www.xfa.org/schema/xfa-data/1.0/\">"
                    + "<xfa:data></xfa:data>"
                    + "</xfa:datasets>"
    ).getBytes(StandardCharsets.UTF_8);

    private static void fillXfaDatasets(Path template, Path datasetsXml, Path output, boolean appendMode) throws Exception {
        Files.createDirectories(output.getParent());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("engine", appendMode ? "itext-pdfxfa-append" : "itext-pdfxfa-rewrite");
        result.put("output", output.toString());
        result.put("datasets_xml", datasetsXml.toString());

        try (PdfReader reader = openReader(template);
             PdfWriter writer = new PdfWriter(output.toString());
             PdfDocument pdf = appendMode
                     ? new PdfDocument(reader, writer, new StampingProperties().useAppendMode())
                     : new PdfDocument(reader, writer)) {

            PdfAcroForm acro = PdfAcroForm.getAcroForm(pdf, true);
            boolean injected = ensureDatasetsPacket(pdf, acro);
            result.put("datasets_packet_injected", injected);

            // Rebuild after packet mutation — cached XfaForm may not see new /XFA entry.
            XfaForm xfa = new XfaForm(pdf);
            result.put("xfa_present", xfa.isXfaPresent());

            // fillXfaForm replaces the first element under datasets/data.
            // Passing <xfa:datasets>/<xfa:data> wrappers nests incorrectly and fields stay blank.
            org.w3c.dom.Document xmlDoc = parseXmlDocument(datasetsXml);
            org.w3c.dom.Element dataRoot = unwrapXfaDataRoot(xmlDoc);
            xfa.fillXfaForm(dataRoot);
            xfa.write(pdf);

            // Sync AcroForm /V so Chrome/Edge/Preview show values (Adobe primarily reads XFA).
            int synced = syncAcroFormFromDataRoot(acro, dataRoot);
            result.put("acroform_fields_synced", synced);
        }

        result.put("flattened", false);
        writeJson(result, null);
    }

    /**
     * IMM 5669 (and some older Designer forms) ship without a named {@code datasets}
     * packet. iText {@code XfaForm.write} only persists datasets when both template and
     * datasets slots exist in the /XFA PdfArray — so inject an empty packet first.
     *
     * @return true if a new datasets packet was inserted
     */
    private static boolean ensureDatasetsPacket(PdfDocument pdf, PdfAcroForm acro) {
        PdfObject xfaObj = acro.getPdfObject().get(PdfName.XFA);
        if (xfaObj == null || !xfaObj.isArray()) {
            return false;
        }

        PdfArray ar = (PdfArray) xfaObj;
        int templateNameIdx = -1;
        int localeSetIdx = -1;
        for (int k = 0; k < ar.size(); k += 2) {
            PdfString s = ar.getAsString(k);
            if (s == null) {
                continue;
            }
            String name = s.toUnicodeString();
            if ("datasets".equals(name)) {
                return false;
            }
            if ("template".equals(name)) {
                templateNameIdx = k;
            }
            if ("localeSet".equals(name) && localeSetIdx < 0) {
                localeSetIdx = k;
            }
        }

        int insertAt;
        if (localeSetIdx >= 0) {
            insertAt = localeSetIdx;
        } else if (templateNameIdx >= 0) {
            insertAt = templateNameIdx + 2;
        } else {
            insertAt = ar.size();
        }

        PdfStream ds = new PdfStream(EMPTY_DATASETS_PACKET);
        ar.add(insertAt, new PdfString("datasets"));
        ar.add(insertAt + 1, ds);
        ar.setModified();
        acro.put(PdfName.XFA, ar);
        acro.setModified();
        return true;
    }

    private static org.w3c.dom.Document parseXmlDocument(Path xmlPath) throws Exception {
        javax.xml.parsers.DocumentBuilderFactory factory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        javax.xml.parsers.DocumentBuilder builder = factory.newDocumentBuilder();
        try (FileInputStream in = new FileInputStream(xmlPath.toFile())) {
            return builder.parse(in);
        }
    }

    /**
     * Accept either a bare form root (IMM_5476) or a full datasets/data wrapper and
     * return the element that must be placed under datasets/data.
     */
    private static org.w3c.dom.Element unwrapXfaDataRoot(org.w3c.dom.Document doc) {
        org.w3c.dom.Element root = doc.getDocumentElement();
        if (root == null) {
            throw new IllegalArgumentException("Datasets XML has no root element.");
        }

        String local = root.getLocalName() != null ? root.getLocalName() : root.getNodeName();
        if ("datasets".equals(local)) {
            org.w3c.dom.Element data = firstChildElement(root, "data");
            if (data == null) {
                throw new IllegalArgumentException("xfa:datasets is missing xfa:data.");
            }
            org.w3c.dom.Element formRoot = firstChildElement(data, null);
            if (formRoot == null) {
                throw new IllegalArgumentException("xfa:data is empty.");
            }
            return formRoot;
        }

        if ("data".equals(local)) {
            org.w3c.dom.Element formRoot = firstChildElement(root, null);
            if (formRoot == null) {
                throw new IllegalArgumentException("xfa:data is empty.");
            }
            return formRoot;
        }

        return root;
    }

    private static org.w3c.dom.Element firstChildElement(org.w3c.dom.Node parent, String localNameOrNull) {
        org.w3c.dom.NodeList children = parent.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            org.w3c.dom.Node n = children.item(i);
            if (n.getNodeType() != org.w3c.dom.Node.ELEMENT_NODE) {
                continue;
            }
            org.w3c.dom.Element el = (org.w3c.dom.Element) n;
            if (localNameOrNull == null) {
                return el;
            }
            String local = el.getLocalName() != null ? el.getLocalName() : el.getNodeName();
            if (localNameOrNull.equals(local)) {
                return el;
            }
        }
        return null;
    }

    /**
     * Best-effort AcroForm value sync from the XFA data root for non-Adobe viewers.
     * Field SOM paths use [0] occurrence indexes matching IRCC hybrid templates.
     */
    private static int syncAcroFormFromDataRoot(PdfAcroForm acro, org.w3c.dom.Element dataRoot) {
        return syncAcroFormNode(acro, dataRoot, "");
    }

    private static int syncAcroFormNode(PdfAcroForm acro, org.w3c.dom.Element el, String parentPath) {
        String local = el.getLocalName() != null ? el.getLocalName() : el.getNodeName();
        if (local.contains(":")) {
            local = local.substring(local.indexOf(':') + 1);
        }
        String path = parentPath.isEmpty() ? local + "[0]" : parentPath + "." + local + "[0]";

        java.util.ArrayList<org.w3c.dom.Element> kids = new java.util.ArrayList<>();
        org.w3c.dom.NodeList children = el.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            org.w3c.dom.Node n = children.item(i);
            if (n.getNodeType() == org.w3c.dom.Node.ELEMENT_NODE) {
                kids.add((org.w3c.dom.Element) n);
            }
        }

        if (kids.isEmpty()) {
            String value = el.getTextContent() != null ? el.getTextContent().trim() : "";
            if (value.isEmpty()) {
                return 0;
            }
            PdfFormField field = acro.getField(path);
            if (field == null) {
                return 0;
            }
            try {
                field.setValue(value);
                try {
                    field.regenerateField();
                } catch (Exception ignoredAppearance) {
                    // Some hybrid widgets reject appearance regen; /V is still set.
                }
                return 1;
            } catch (Exception ignored) {
                return 0;
            }
        }

        int synced = 0;
        for (org.w3c.dom.Element kid : kids) {
            synced += syncAcroFormNode(acro, kid, path);
        }
        return synced;
    }

    /**
     * Browser-visible preview: flatten filled XFA PDF to a static PDF.
     * Official submission downloads must keep the unflattened append-mode file.
     * Requires ITEXT_LICENSE_FILE (trial/commercial JSON including pdfXFA).
     */
    private static void flattenXfa(Path filledPdf, Path output) throws Exception {
        Files.createDirectories(output.getParent());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("engine", "itext-pdfxfa-flatten");
        result.put("input", filledPdf.toString());
        result.put("output", output.toString());

        XFAFlattenerProperties properties = new XFAFlattenerProperties();
        properties.setOpenPassword("".getBytes(StandardCharsets.UTF_8));

        XFAFlattener flattener = new XFAFlattener();
        flattener.setFlattenerProperties(properties);
        try (FileInputStream in = new FileInputStream(filledPdf.toFile());
             FileOutputStream out = new FileOutputStream(output.toFile())) {
            flattener.flatten(in, out);
        }

        result.put("flattened", true);
        result.put("output_sha256", sha256(output));
        result.put("output_size", Files.size(output));
        writeJson(result, null);
    }

    private static void compare(Path source, Path filled, Path reportOut) throws Exception {
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("source_sha256", sha256(source));
        report.put("filled_sha256", sha256(filled));
        report.put("source_size", Files.size(source));
        report.put("filled_size", Files.size(filled));

        try (PdfReader sReader = openReader(source);
             PdfDocument sPdf = new PdfDocument(sReader);
             PdfReader fReader = openReader(filled);
             PdfDocument fPdf = new PdfDocument(fReader)) {

            report.put("source_pages", sPdf.getNumberOfPages());
            report.put("filled_pages", fPdf.getNumberOfPages());
            report.put("page_count_match", sPdf.getNumberOfPages() == fPdf.getNumberOfPages());

            XfaForm sXfa = new XfaForm(sPdf);
            XfaForm fXfa = new XfaForm(fPdf);
            report.put("source_xfa_present", sXfa.isXfaPresent());
            report.put("filled_xfa_present", fXfa.isXfaPresent());

            PdfAcroForm sAcro = PdfAcroForm.getAcroForm(sPdf, false);
            PdfAcroForm fAcro = PdfAcroForm.getAcroForm(fPdf, false);
            report.put("source_acroform_fields", sAcro != null ? sAcro.getAllFormFields().size() : 0);
            report.put("filled_acroform_fields", fAcro != null ? fAcro.getAllFormFields().size() : 0);
        }

        writeJson(report, reportOut);
    }

    private static void writeJson(Map<String, Object> data, Path reportOut) throws Exception {
        String json = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT).writeValueAsString(data);
        System.out.println(json);
        if (reportOut != null) {
            Files.createDirectories(reportOut.getParent());
            Files.writeString(reportOut, json);
        }
    }

    private static Map<String, String> parseFieldArgs(String[] args, int start) {
        Map<String, String> values = new LinkedHashMap<>();
        for (int i = start; i < args.length; i++) {
            String part = args[i];
            int eq = part.indexOf('=');
            if (eq > 0) {
                values.put(part.substring(0, eq), part.substring(eq + 1));
            }
        }
        return values;
    }

    private static String sha256(Path path) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] bytes = Files.readAllBytes(path);
        byte[] hash = digest.digest(bytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
