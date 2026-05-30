module.exports = {
  PORT: 3000,
  MIN_PLAYERS: 6,
  MAX_PLAYERS: 12,
  PHASE_TIMERS: {
    night: 45,
    day: 90,
    voting: 30,
    hunterShoot: 15,
    gameStartCountdown: 5
  },
  ROOM_CODE_LENGTH: 4,
  DISCONNECT_TIMEOUT: 60,
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_BASE_DELAY: 2000,
  CHAT_MAX_MESSAGES: 200,

  // 角色分配表: 按总人数 -> 各角色数量
  getRoleDistribution(total) {
    const wolves = Math.floor(total / 3);
    const villagers = total - wolves - 3; // 减去预言家+女巫+猎人
    return { werewolves: wolves, seer: 1, witch: 1, hunter: 1, villagers };
  }
};
