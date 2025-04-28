const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000; // Você pode mudar a porta se quiser
app.use(cors());

app.use('/static', express.static('static'));

// Serve a pasta de streams (arquivos .m3u8 e .ts)
app.use('/streams', express.static(path.join(__dirname, 'static', 'streams')));

// Serve a pasta de templates (index.html e logo)
app.use('/templates', express.static(path.join(__dirname, 'templates')));

let currentFFmpegProcess = null;

// Lista de câmeras
const cameras = [
  { channel: 1, output: 'boa_viagem/boa_viagem.m3u8' },
  { channel: 2, output: 'guararapes/guararapes.m3u8' },
  { channel: 3, output: 'rua_da_aurora/rua_da_aurora.m3u8' },
  { channel: 4, output: 'derby/derby.m3u8' },
  { channel: 5, output: 'conde_da_boa_vista/conde_da_boa_vista.m3u8' },
  { channel: 6, output: 'br_101/br_101.m3u8' },
  { channel: 7, output: 'pe_15/pe_15.m3u8' },
  { channel: 8, output: 'torre_aurora/torre_aurora.m3u8' },
  { channel: 9, output: 'caruaru/caruaru.m3u8' }
];

function clearFolder(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const filePath = path.join(folderPath, file);
      if (fs.lstatSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });
  }
}

// Função para iniciar o FFmpeg para capturar a câmera
function startStream(channel, output) {
  console.log(`Iniciando o stream para o canal ${channel}...`);

  // Se já existir um processo de ffmpeg rodando, mata ele
  if (currentFFmpegProcess) {
    console.log('Parando o stream anterior...');
    currentFFmpegProcess.kill('SIGKILL'); // ou SIGTERM
    currentFFmpegProcess = null;
  }

  const rtspUrl = `rtsp://Porto:Porto@9000@168.90.225.117:554/cam/realmonitor?channel=${channel}&subtype=1`;
  const outputPath = path.join(__dirname, 'static', 'streams', output);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  clearFolder(path.dirname(outputPath));

  const ffmpeg = spawn('ffmpeg', [
    '-rtsp_transport', 'tcp',
    '-max_delay', '500000', // 500ms
    '-i', rtspUrl,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '10',
    '-hls_flags', 'delete_segments',
    '-start_number', '1',
    outputPath
  ]);
  

  ffmpeg.stdout.on('data', (data) => {
    console.log(`FFmpeg [Canal ${channel}] stdout: ${data.toString()}`);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`FFmpeg [Canal ${channel}] stderr: ${data.toString()}`);
  });

  ffmpeg.on('error', (err) => {
    console.error(`Erro ao iniciar o FFmpeg para o canal ${channel}:`, err);
  });

  // Guarda o processo atual
  currentFFmpegProcess = ffmpeg;
}


// Página inicial que serve o HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// Endpoint para iniciar o stream
app.post('/start-stream/:channel', (req, res) => {
  console.log('Requisição para iniciar o stream recebida');
  const channel = parseInt(req.params.channel);
  console.log(`Requisição para iniciar o stream do canal ${channel}`);
  
  const camera = cameras.find(c => c.channel === channel);

  if (!camera) {
    return res.status(404).send('Câmera não encontrada');
  }

  try {
    startStream(channel, camera.output);
    res.send('Stream iniciado');
  } catch (err) {
    console.error('Erro ao iniciar stream:', err);
    res.status(500).send('Erro ao iniciar stream');
  }
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
