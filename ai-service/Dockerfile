FROM python:3.11-slim

# System libs needed by OpenCV and EasyOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# CPU-only PyTorch keeps the image small (default pip wheel pulls ~900MB CUDA deps).
COPY requirements.txt constraints.txt ./
# Install CPU torch first, then everything else with constraints so easyocr cannot upgrade torchvision.
RUN pip install --no-cache-dir torch==2.2.2 torchvision==0.17.2 \
    --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt -c constraints.txt

# Copy application source
COPY . .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
