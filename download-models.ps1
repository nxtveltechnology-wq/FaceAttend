$baseUrl = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
$targetDir = "public/models"
$files = @(
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
)

# Create directory if it doesn't exist
if (!(Test-Path -Path $targetDir)) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    Write-Host "Created directory: $targetDir"
}

foreach ($file in $files) {
    $url = "$baseUrl/$file"
    $output = "$targetDir/$file"
    
    Write-Host "Downloading $file..."
    try {
        Invoke-WebRequest -Uri $url -OutFile $output
        Write-Host "Successfully downloaded $file" -ForegroundColor Green
    } catch {
        Write-Host "Failed to download $file. Error: $_" -ForegroundColor Red
    }
}

Write-Host "All downloads complete."
