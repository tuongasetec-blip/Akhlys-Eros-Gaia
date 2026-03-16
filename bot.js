const http = require('http');
const mineflayer = require('mineflayer');

http.createServer((req, res) => {
  res.write("Bot is alive!");
  res.end();
}).listen(process.env.PORT || 8080);

const BOT_NAMES = ['Akhlys','Eros','Gaia'];

const CONFIG = {
  host: 'pe.notmc.net',
  port: 25565,
  version: '1.21.4',
  auth: 'offline',
  password: 'hung2312',
  pmPassword: 'spawn',
  reconnectDelay: 5000,
  joinDelay: 3000,
  maxAttempts: 30,
};

const ALLOWED_USERS = ['Hypnos','GHypnos','Spelas','DreamMask_','Gzues'];
const activeBots = {};
const offlineMap = {};

const log = (name, msg) => console.log(`[${name}] ${msg}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function createBot(name) {
  offlineMap[name] = false;

  const bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: name,
    version: CONFIG.version,
    auth: CONFIG.auth,
    viewDistance: 'tiny',
    checkTimeoutInterval: 90000,
  });

  bot.setMaxListeners(50);
  activeBots[name] = bot;

  let isCheckingIn = false;
  let msgBuffer = [];
  let bufferTimer = null;

  async function doCheckIn() {
    if (isCheckingIn) return;
    isCheckingIn = true;

    if (bot.currentWindow) {
      bot.closeWindow(bot.currentWindow);
      await sleep(500);
    }

    let attempt = 0;
    while (attempt < CONFIG.maxAttempts) {
      attempt++;
      try {
        bot.chat('/diemdanh');
        await sleep(3000);

        if (!bot.currentWindow) {
          log(name, `[ĐIỂM DANH] Lần ${attempt}: GUI không mở, thử lại...`);
          await sleep(5000);
          continue;
        }

        const win = bot.currentWindow;
        const beaconSlot = win.slots.findIndex(item => item && item.name.includes('beacon'));

        if (beaconSlot === -1) {
          log(name, `[ĐIỂM DANH] Lần ${attempt}: Không thấy beacon, thử lại...`);
          bot.closeWindow(win);
          await sleep(5000);
          continue;
        }

        await sleep(500);
        await bot.clickWindow(beaconSlot, 0, 0);
        bot.closeWindow(win);
        log(name, `[ĐIỂM DANH] Hoàn thành sau ${attempt} lần`);
        isCheckingIn = false;
        return;

      } catch (err) {
        log(name, `[ĐIỂM DANH] Lần ${attempt}: ${err.message}`);
        if (bot.currentWindow) bot.closeWindow(bot.currentWindow);
        await sleep(5000);
      }
    }

    log(name, `[ĐIỂM DANH] Bỏ qua sau ${CONFIG.maxAttempts} lần`);
    isCheckingIn = false;
  }

  bot.on('message', (jsonMsg) => {
    const msg = jsonMsg.toString();
    const clean = msg.replace(/§[0-9a-fklmnor]/g, '').toLowerCase();
    log(name, msg);

    if (clean.includes('[thông báo]')) {
      setTimeout(() => bot.chat('/server earth'), 5000);
    }

    if (clean.includes('chưa nhận hết phần thưởng')) {
      setTimeout(() => doCheckIn(), Math.random() * 5000);
    }

    const isFromAllowedUser = ALLOWED_USERS.some(u => msg.includes(u));
    if (isFromAllowedUser && msg.includes('[Discord | Member]')) {
      if (clean.includes('offline')) {
        const target = BOT_NAMES.find(n => clean.includes(n.toLowerCase()));
        if (target && activeBots[target]) {
          log(target, `[Discord] Offline lệnh`);
          offlineMap[target] = true;
          activeBots[target].quit();
        }
      }
    }

    msgBuffer.push(msg);
    if (bufferTimer) clearTimeout(bufferTimer);
    bufferTimer = setTimeout(() => {
      const combined = msgBuffer.join('\n');
      msgBuffer = [];

      if (!combined.includes('✉') || !combined.includes('ᴛɪɴ ɴʜắɴ ʀɪêɴɢ')) return;

      const lines = combined.split('\n');
      const senderLine = lines.find(l => l.includes('→'));
      const contentLine = lines.find(l => l.includes('›'));
      if (!senderLine || !contentLine) return;

      const sender = senderLine.split('→')[0].trim().replace(/§[0-9a-fklmnor]/g, '').trim();
      const content = contentLine.replace('›', '').trim().replace(/§[0-9a-fklmnor]/g, '').trim();

      if (!ALLOWED_USERS.includes(sender)) return;

      const parts = content.split(' ');
      const password = parts[parts.length - 1];
      const command = parts.slice(0, -1).join(' ');

      if (password !== CONFIG.pmPassword) {
        log(name, `[PM] Sai mật khẩu từ ${sender}`);
        return;
      }

      if (command === 'dropkey') {
        const items = bot.inventory.items().filter(item => item.name.includes('tripwire_hook'));
        if (items.length === 0) {
          log(name, `[PM] Không có tripwire hook`);
          return;
        }
        (async () => {
          for (const item of items) {
            await bot.tossStack(item);
            await sleep(200);
          }
          log(name, `[PM] Đã drop ${items.length} tripwire hook`);
        })();
        return;
      }

      log(name, `[PM] Thực thi: ${command}`);
      bot.chat(command);
    }, 300);
  });

  bot.once('spawn', () => {
    bot.physics.enabled = false;
    log(name, 'Vào Lobby. Login...');
    setTimeout(() => {
      bot.chat(`/login ${CONFIG.password}`);
      setTimeout(() => {
        bot.chat('/server earth');
      }, 2000);
    }, 2000);
  });

  bot.on('end', () => {
    bot.removeAllListeners();
    delete activeBots[name];
    const delay = offlineMap[name] ? 60000 : CONFIG.reconnectDelay;
    log(name, `Mất kết nối. Reconnect sau ${delay / 1000}s...`);
    offlineMap[name] = false;
    setTimeout(() => createBot(name), delay);
  });

  bot.on('error', (err) => {
    log(name, err.code === 'ECONNREFUSED' ? 'Server không phản hồi.' : `Lỗi: ${err.message}`);
  });
}

async function startAllBots() {
  for (const name of BOT_NAMES) {
    createBot(name);
    await sleep(CONFIG.joinDelay);
  }
  log('SYSTEM', `Đã kích hoạt ${BOT_NAMES.length} bot`);
}

startAllBots();
