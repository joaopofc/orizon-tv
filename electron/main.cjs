const { app, BrowserWindow, ipcMain, screen, nativeImage, utilityProcess } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const http = require('http');

// Identificador oficial do app no Windows para fixação correta na barra de tarefas e ícone perfeito
if (process.platform === 'win32') {
  app.setAppUserModelId('com.orizontv.app');
}

// Aceleração máxima de hardware e renderização nativa por GPU (60-144 FPS)
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

let mainWindow;
let serverProcess = null;

const isDev = !app.isPackaged;

function checkServer(port = 3001) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/status`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startBackendServer() {
  if (isDev) {
    console.log('[Electron] Modo Dev: Servidor backend gerenciado pelo script do npm.');
    return;
  }

  const isRunning = await checkServer(3001);
  if (isRunning) {
    console.log('[Electron] Servidor Orizon TV já está ativo na porta 3001.');
    return;
  }

  const serverCandidates = [
    path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'index.js'),
    path.join(process.resourcesPath, 'server', 'index.js'),
    path.join(__dirname, '..', 'server', 'index.js')
  ];
  const serverPath = serverCandidates.find(p => fs.existsSync(p)) || serverCandidates[0];

  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'data');
  const logFile = path.join(userDataPath, 'server.log');

  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  } catch {}

  console.log(`[Electron] Iniciando servidor backend a partir de: ${serverPath}`);

  try {
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    logStream.write(`\n--- [${new Date().toISOString()}] Iniciando Orizon Engine Backend ---\n`);

    serverProcess = fork(serverPath, [], {
      execPath: process.execPath,
      env: {
        ...process.env,
        PORT: '3001',
        NODE_ENV: 'production',
        ORIZON_DATA_DIR: dataDir,
        NODE_PATH: path.join(process.resourcesPath, 'app.asar', 'node_modules'),
        ELECTRON_RUN_AS_NODE: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    });

    if (serverProcess.stdout) {
      serverProcess.stdout.pipe(logStream);
      serverProcess.stdout.on('data', (data) => {
        console.log(`[Server] ${data.toString().trim()}`);
      });
    }

    if (serverProcess.stderr) {
      serverProcess.stderr.pipe(logStream);
      serverProcess.stderr.on('data', (data) => {
        console.error(`[Server Erro] ${data.toString().trim()}`);
      });
    }

    serverProcess.on('exit', (code, signal) => {
      const msg = `[Electron] Backend finalizado. Código: ${code}, Sinal: ${signal}\n`;
      console.log(msg);
      logStream.write(msg);
    });

    serverProcess.on('error', (err) => {
      const msg = `[Electron] Falha ao disparar processo do backend: ${err.message}\n`;
      console.error(msg);
      logStream.write(msg);
    });

    // Aguarda o servidor subir e responder status 200
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 200));
      if (await checkServer(3001)) {
        console.log('[Electron] Servidor Orizon TV online com sucesso.');
        break;
      }
    }
  } catch (err) {
    console.error('[Electron] Erro crítico ao iniciar servidor:', err);
  }
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Carrega ícone oficial (.ico multipágina no Windows ou PNG de alta definição)
  let appIcon = undefined;
  const iconCandidates = [
    path.join(__dirname, '..', 'public', 'icon.ico'),
    path.join(__dirname, '..', 'dist', 'icon.ico'),
    path.join(process.resourcesPath, 'public', 'icon.ico'),
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(__dirname, '..', 'public', 'logo.png'),
    path.join(__dirname, '..', 'dist', 'logo.png'),
    path.join(process.resourcesPath, 'public', 'logo.png')
  ];

  for (const candidate of iconCandidates) {
    if (fs.existsSync(candidate)) {
      appIcon = nativeImage.createFromPath(candidate);
      if (!appIcon.isEmpty()) break;
    }
  }

  mainWindow = new BrowserWindow({
    width: Math.min(1366, width),
    height: Math.min(768, height),
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0c0f17',
    title: 'Orizon TV',
    icon: appIcon,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0c0f17',
      symbolColor: '#94a3b8',
      height: 38
    },
    show: false, // Só exibe após o conteúdo estar pronto para evitar piscada preta
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Permite carregar fluxos de mídia sem bloqueio de protocolo local
    }
  });

  // Exibe a janela suavemente assim que o DOM estiver pronto
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const startUrl = isDev 
    ? 'http://localhost:5173' 
    : 'http://127.0.0.1:3001';

  // Log de erros do renderer diretamente no terminal
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) { // Erros e avisos
      console.log(`[Renderer L${level}] ${message} (${sourceId}:${line})`);
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Falha ao carregar ${validatedURL}: [${errorCode}] ${errorDescription}`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(startUrl).catch(() => {});
      }
    }, 1000);
  });

  mainWindow.webContents.on('render-process-gone', (event, detailed) => {
    console.error('[Electron] Render process crashed/gone:', detailed);
  });

  // Desativa navegação ao arrastar arquivos ou links para dentro da janela
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  // Bloqueia menu de contexto nativo do Chromium para imagens e links (impede salvar imagem)
  mainWindow.webContents.on('context-menu', (event, params) => {
    if (params.mediaType === 'image' || params.linkURL) {
      event.preventDefault();
    }
  });

  const loadApp = () => {
    mainWindow.loadURL(startUrl).catch((err) => {
      console.log('[Electron] Aguardando Vite iniciar...', err?.message || '');
      setTimeout(loadApp, 800);
    });
  };

  loadApp();

  // Em modo dev, se a tecla F12 for pressionada, abre o DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Inicia o backend Node.js
  await startBackendServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

function cleanup() {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {}
    serverProcess = null;
  }
}

app.on('before-quit', cleanup);

app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
