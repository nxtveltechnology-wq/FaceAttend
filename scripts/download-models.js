import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUrl = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";
// Target directory is ../public/models relative to this script
const targetDir = path.resolve(__dirname, '../public/models');

const files = [
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
];

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`Created directory: ${targetDir}`);
}

const downloadFile = (file) => {
    return new Promise((resolve, reject) => {
        const url = `${baseUrl}/${file}`;
        const outputPath = path.join(targetDir, file);
        const fileStream = fs.createWriteStream(outputPath);

        console.log(`Downloading ${file}...`);

        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${file}: Status Code ${response.statusCode}`));
                return;
            }

            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`Successfully downloaded ${file}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(outputPath, () => {}); // Delete partial file
            reject(err);
        });
    });
};

async function downloadAll() {
    try {
        for (const file of files) {
           await downloadFile(file);
        }
        console.log("All model downloads complete.");
    } catch (error) {
        console.error("Error downloading models:", error);
        process.exit(1);
    }
}

downloadAll();
