const crypto = require('crypto');
const config = require('./config');

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉容易混淆的 0/O/1/I
  let code = '';
  for (let i = 0; i < config.ROOM_CODE_LENGTH; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

function generatePlayerId() {
  return 'p_' + crypto.randomBytes(4).toString('hex');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = { generateRoomCode, generatePlayerId, shuffle };
