package com.rcicmaster.governmentforms;

import com.aspose.pdf.Document;
import com.aspose.pdf.Form;
import com.aspose.pdf.FormType;
import com.aspose.pdf.TextBoxField;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

public class AsposePocMain {
    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            System.err.println("Usage: AsposePocMain fill <template.pdf> <output.pdf> field=value ...");
            System.exit(1);
        }
        if (!"fill".equals(args[0])) {
            throw new IllegalArgumentException("Unknown command: " + args[0]);
        }
        Path template = Path.of(args[1]);
        Path output = Path.of(args[2]);
        Map<String, String> values = new LinkedHashMap<>();
        for (int i = 3; i < args.length; i++) {
            String part = args[i];
            int eq = part.indexOf('=');
            if (eq > 0) {
                values.put(part.substring(0, eq), part.substring(eq + 1));
            }
        }
        fill(template, output, values);
    }

    private static void fill(Path template, Path output, Map<String, String> values) throws Exception {
        Files.createDirectories(output.getParent());
        Document doc = new Document(template.toString());
        Form form = doc.getForm();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("engine", "aspose-pdf-eval");
        result.put("form_type", form.getType().toString());
        result.put("has_xfa", form.getType() == FormType.Dynamic);

        for (Map.Entry<String, String> entry : values.entrySet()) {
            if (form.hasField(entry.getKey())) {
                var widget = form.get(entry.getKey());
                if (widget instanceof TextBoxField textField) {
                    textField.setValue(entry.getValue());
                }
            }
        }
        doc.save(output.toString());
        doc.close();

        result.put("output", output.toString());
        result.put("flattened", false);
        result.put("written_fields", values.keySet());
        System.out.println(new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT).writeValueAsString(result));
    }
}
