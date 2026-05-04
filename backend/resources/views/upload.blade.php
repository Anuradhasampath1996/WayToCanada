<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Upload Document — WayToCanada</title>
    <style>
        body { font-family: sans-serif; max-width: 520px; margin: 60px auto; padding: 0 16px; }
        h2   { margin-bottom: 24px; }
        label { display: block; margin-bottom: 6px; font-weight: 600; }
        select, input[type="file"] { width: 100%; padding: 8px; margin-bottom: 16px; box-sizing: border-box; }
        button { padding: 10px 24px; background: #1a56db; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #1446b8; }
        #result { margin-top: 20px; padding: 12px; border-radius: 4px; display: none; }
        .success { background: #d1fae5; color: #065f46; }
        .error   { background: #fee2e2; color: #991b1b; }
    </style>
</head>
<body>
    <h2>Upload Document</h2>

    <form id="uploadForm">
        @csrf

        <label for="type">Document Type</label>
        <select id="type" name="type">
            <option value="client-document">Client Document</option>
            <option value="rcic-certificate">RCIC Certificate</option>
            <option value="other">Other</option>
        </select>

        <label for="file">File (PDF / JPG / PNG — max 10 MB)</label>
        <input type="file" id="file" name="file" accept=".pdf,.jpg,.jpeg,.png" required>

        <button type="submit">Upload to S3</button>
    </form>

    <div id="result"></div>

    <script>
        document.getElementById('uploadForm').addEventListener('submit', async function (e) {
            e.preventDefault();

            const form     = e.target;
            const data     = new FormData(form);
            const resultEl = document.getElementById('result');

            resultEl.style.display = 'none';
            resultEl.className     = '';

            try {
                const response = await fetch('/api/v1/documents/upload', {
                    method: 'POST',
                    headers: { 'X-CSRF-TOKEN': document.querySelector('[name="_token"]').value },
                    body: data,
                });

                const json = await response.json();

                resultEl.style.display = 'block';

                if (response.ok) {
                    resultEl.classList.add('success');
                    resultEl.textContent = `Uploaded! Path: ${json.path} (bucket: ${json.bucket})`;
                } else {
                    resultEl.classList.add('error');
                    resultEl.textContent = json.message ?? 'Upload failed.';
                }
            } catch (err) {
                resultEl.style.display = 'block';
                resultEl.classList.add('error');
                resultEl.textContent = 'Network error: ' + err.message;
            }
        });
    </script>
</body>
</html>
