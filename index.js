const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
app.use(express.json());

const jobs = {};

app.post('/clip-video', async (req, res) => {
  const { videoUrl, start, end } = req.body;
  if (!videoUrl || start == null || end == null) {
    return res.status(400).json({ error: 'videoUrl, start, and end are required' });
  }

  const jobId = uuidv4();
  const inputPath = path.join(__dirname, 'downloads', `${jobId}.mp4`);
  const outputDir = path.join(__dirname, 'results');
  const outputFilename = `output-${jobId}.mp4`;
  const outputPath = path.join(outputDir, outputFilename);

  fs.mkdirSync(path.dirname(inputPath), { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  jobs[jobId] = { status: 'processing', output: null };

  (async () => {
    try {
      const writer = fs.createWriteStream(inputPath);
      const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(start)
          .setDuration(end - start)
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      jobs[jobId].status = 'done';
      jobs[jobId].output = outputFilename;

      fs.unlinkSync(inputPath);
    } catch (err) {
      console.error(err);
      jobs[jobId].status = 'error';
    }
  })();

  res.json({ job_id: jobId });
});

app.get('/clip-video/result', (req, res) => {
  const { job_id: jobId } = req.query;
  if (!jobId || !jobs[jobId]) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const job = jobs[jobId];
  if (job.status !== 'done') {
    return res.json({ status: job.status });
  }

  const host = req.get('host');
  const protocol = req.protocol;
  const videoUrl = `${protocol}://${host}/results/${job.output}`;
  res.json({ status: 'done', video_url: videoUrl });
});

app.use('/results', express.static(path.join(__dirname, 'results')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});