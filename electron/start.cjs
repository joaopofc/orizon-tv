// Inicia o Electron garantindo a remoção de ELECTRON_RUN_AS_NODE herdado do terminal/IDE
const { spawn } = require('child_process');
const electronPath = require('electron');

const cleanEnv = { ...process.env };
delete cleanEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: cleanEnv
});

child.on('close', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('[Electron Runner Error]:', err);
  process.exit(1);
});

