/**
 * Day 屏幕：白天死亡公告 + 讨论
 */
const DayScreen = {
  players: [],
  round: 1,
  isHost: false,

  setup(data) {
    this.round = data.round || 1;
    this.players = data.players || [];
    this.isHost = this.players.some(p => p.id === App.playerId && p.isHost);

    document.getElementById('day-round-title').textContent = `☀️ 第 ${this.round} 天`;
    document.getElementById('day-chat-messages').innerHTML = '';

    // 渲染玩家状态
    this.renderPlayerStatus();

    // 隐藏/显示跳过投票按钮（房主可见）
    const skipBtn = document.getElementById('btn-skip-voting');
    skipBtn.style.display = this.isHost ? 'inline-flex' : 'none';
    skipBtn.onclick = () => {
      ws.send('SKIP_TO_VOTING', { roomCode: App.roomCode, playerId: App.playerId });
    };

    // 聊天
    this.setupChat();

    // 死人禁言
    const me = this.players.find(p => p.id === App.playerId);
    const chatRow = document.getElementById('day-chat-input-row');
    if (me && !me.isAlive) {
      const input = document.getElementById('day-chat-input');
      if (input) {
        input.disabled = true;
        input.placeholder = '你已死亡，无法发言';
      }
      const btn = document.getElementById('btn-day-chat-send');
      if (btn) btn.disabled = true;
    }
  },

  handleMessage(msg) {
    switch (msg.type) {
      case 'NIGHT_RESULT':
        this.renderDeathAnnounce(msg);
        break;

      case 'PLAYER_LIST_UPDATE':
        this.players = msg.players;
        this.renderPlayerStatus();
        break;

      case 'CHAT_MESSAGE':
        Chat.appendMessage(
          document.getElementById('day-chat-messages'),
          msg,
          App.playerId
        );
        break;

      case 'PHASE_CHANGE':
        if (msg.phase === 'VOTING') {
          App.showScreen('voting', { phase: 'VOTING', round: this.round, players: this.players });
        } else if (msg.phase === 'NIGHT') {
          App.showScreen('night', { phase: 'NIGHT', round: msg.round, players: this.players });
        }
        break;

      case 'HUNTER_SHOOT_PROMPT':
        App.showScreen('voting', { hunterShoot: true, ...msg });
        break;

      case 'GAME_OVER':
        App.showScreen('result', msg);
        break;
    }
  },

  renderDeathAnnounce(msg) {
    const container = document.getElementById('day-death');
    if (!msg.deceased || msg.deceased.length === 0) {
      container.innerHTML = `
        <div class="death-icon">🌤️</div>
        <div class="death-text death-none">昨晚是平安夜，无人死亡</div>
        ${msg.witchSaveUsed ? '<p style="text-align:center;color:var(--day-life);font-size:14px;margin-top:4px;">女巫使用了解药</p>' : ''}
      `;
    } else {
      const names = msg.deceased.map(d => d.name).join('、');
      container.innerHTML = `
        <div class="death-icon">💀</div>
        <div class="death-text death-kill">昨晚 ${names} 死亡</div>
        ${msg.witchPoisonUsed ? '<p style="text-align:center;color:var(--day-accent);font-size:14px;margin-top:4px;">女巫使用了毒药</p>' : ''}
      `;
    }

    // 更新玩家状态
    if (msg.deceased) {
      msg.deceased.forEach(d => {
        const p = this.players.find(pl => pl.id === d.id);
        if (p) p.isAlive = false;
      });
      this.renderPlayerStatus();
    }
  },

  renderPlayerStatus() {
    const container = document.getElementById('day-player-list');
    PlayerList.render(container, this.players, { showDead: true });
  },

  setupChat() {
    const input = document.getElementById('day-chat-input');
    const btn = document.getElementById('btn-day-chat-send');

    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      ws.send('CHAT_MESSAGE', { roomCode: App.roomCode, playerId: App.playerId, text });
      input.value = '';
    };

    btn.onclick = send;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') send();
    };
  }
};
