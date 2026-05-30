/**
 * Lobby 屏幕：等待玩家，管理房间
 */
const LobbyScreen = {
  players: [],

  setup(data) {
    document.getElementById('lobby-code').textContent = App.roomCode || '----';
    this.players = data && data.players ? data.players : [];

    this.renderPlayerList();
    this.updateStartButton();

    // 房主才显示开始按钮
    this.updateHostUI();

    // 按钮事件
    document.getElementById('btn-leave').onclick = () => {
      ws.send('LEAVE_ROOM', { roomCode: App.roomCode, playerId: App.playerId });
      App.showScreen('home');
    };

    document.getElementById('btn-start').onclick = () => {
      ws.send('START_GAME', { roomCode: App.roomCode, playerId: App.playerId });
    };

    // 聊天
    const chatInput = document.getElementById('lobby-chat-input');
    document.getElementById('btn-lobby-chat-send').onclick = () => {
      const text = chatInput.value.trim();
      if (!text) return;
      ws.send('CHAT_MESSAGE', { roomCode: App.roomCode, playerId: App.playerId, text });
      chatInput.value = '';
    };
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-lobby-chat-send').click();
    });
  },

  handleMessage(msg) {
    switch (msg.type) {
      case 'PLAYER_LIST_UPDATE':
        this.players = msg.players;
        this.renderPlayerList();
        this.updateStartButton();
        this.updateHostUI();
        break;

      case 'CHAT_MESSAGE':
        Chat.appendMessage(
          document.getElementById('lobby-chat-messages'),
          msg,
          App.playerId
        );
        break;

      case 'GAME_STARTING':
        // 倒计时后进入夜晚
        App.showScreen('night', { countdown: msg.countdown });
        break;

      case 'ERROR':
        App.showToast(msg.message);
        break;
    }
  },

  renderPlayerList() {
    const container = document.getElementById('lobby-player-list');
    PlayerList.render(container, this.players, { showDead: true });
    document.getElementById('lobby-player-count').textContent =
      `${this.players.length} / 12 名玩家（至少 6 人开局）`;
  },

  updateStartButton() {
    const btn = document.getElementById('btn-start');
    const enough = this.players.length >= 6;
    btn.disabled = !enough;
    btn.textContent = enough ? '开始游戏' : `开始游戏（需 6 人以上，当前 ${this.players.length} 人）`;
  },

  updateHostUI() {
    const btn = document.getElementById('btn-start');
    const isHost = this.players.some(p => p.id === App.playerId && p.isHost);
    btn.style.display = isHost ? 'inline-flex' : 'none';
  }
};
