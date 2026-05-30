/**
 * 全局 App 调度器：屏幕切换、消息路由、状态管理
 */
const App = {
  ws: ws,
  playerId: null,
  playerName: '',
  roomCode: '',
  role: null,
  round: 1,
  currentScreen: 'home',

  init() {
    Timer.init();

    document.getElementById('btn-reconnect-retry').onclick = () => {
      ws.manualReconnect();
    };

    // 连接 WebSocket
    ws.connect();

    // 默认显示 home
    this.showScreen('home');
  },

  showScreen(name, data) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => {
      s.classList.remove('active');
      s.classList.add('hidden');
    });

    const target = document.getElementById('screen-' + name);
    if (!target) return;

    target.classList.remove('hidden');
    target.classList.add('active');

    this.currentScreen = name;

    const screenModule = this._getScreen(name);
    if (screenModule && screenModule.setup) {
      screenModule.setup(data || {});
    }
  },

  /**
   * 全局消息路由 — 所有 WS 消息统一入口
   */
  routeMessage(msg) {
    // === 全局处理（不依赖当前屏幕） ===
    switch (msg.type) {
      case 'TIMER_TICK':
        Timer.tick(msg.secondsRemaining);
        return;

      case 'PHASE_CHANGE':
        this.round = msg.round || this.round;
        Timer.start(msg.timerSeconds);
        // 阶段切换逻辑：由当前屏幕决定是否跳转
        if (msg.phase === 'NIGHT' && this.currentScreen === 'lobby') {
          this.showScreen('night', { phase: 'NIGHT', round: msg.round, players: msg.players || [] });
          return;
        }
        if (msg.phase === 'DAY' && this.currentScreen === 'night') {
          this.showScreen('day', { phase: 'DAY', round: msg.round, players: msg.players || [] });
          return;
        }
        if (msg.phase === 'VOTING' && this.currentScreen === 'day') {
          this.showScreen('voting', { phase: 'VOTING', round: this.round, players: msg.players || [] });
          return;
        }
        if (msg.phase === 'NIGHT' && this.currentScreen === 'voting') {
          this.showScreen('night', { phase: 'NIGHT', round: msg.round, players: msg.players || [] });
          return;
        }
        if (msg.phase === 'NIGHT' && this.currentScreen === 'day') {
          this.showScreen('night', { phase: 'NIGHT', round: msg.round, players: msg.players || [] });
          return;
        }
        break;

      case 'YOUR_ROLE':
        this.role = msg.role;
        if (this.currentScreen === 'night') {
          // 重新渲染夜晚面板
          const nightArea = document.getElementById('night-action-area');
          NightScreen.role = msg.role;
          NightScreen.roleData = msg;
          NightScreen.renderRolePanel(nightArea);
        }
        return;

      case 'GAME_OVER':
        Timer.reset();
        this.showScreen('result', msg);
        return;

      case 'ERROR':
        this.showToast(msg.message);
        return;

      case 'STATE_SYNC':
        this._handleStateSync(msg);
        return;

      case 'RECONNECT_OK':
        ws.needsReconnect = false;
        return;

      case 'ROOM_CREATED':
        this.playerId = msg.playerId;
        this.roomCode = msg.roomCode;
        this.showScreen('lobby');
        return;

      case 'ROOM_JOINED':
        this.playerId = msg.playerId;
        this.roomCode = msg.roomCode;
        this.showScreen('lobby');
        return;

      case 'PLAYER_DISCONNECTED':
        this.showToast(`${msg.playerName} 断线了`);
        break;

      case 'PLAYER_RECONNECTED':
        this.showToast(`${msg.playerName} 已重连`, 'success');
        break;
    }

    // === 转发到当前屏幕 ===
    const screen = this._getScreen(this.currentScreen);
    if (screen && screen.handleMessage) {
      screen.handleMessage(msg);
    }
  },

  _getScreen(name) {
    const map = {
      'home': HomeScreen,
      'lobby': LobbyScreen,
      'night': NightScreen,
      'day': DayScreen,
      'voting': VotingScreen,
      'result': ResultScreen
    };
    return map[name] || {};
  },

  _handleStateSync(msg) {
    this.role = msg.yourRole;
    this.round = msg.round;

    const phase = msg.state;
    if (phase === 'WAITING') {
      this.showScreen('lobby', { players: msg.players });
    } else if (phase === 'NIGHT') {
      this.showScreen('night', {
        role: msg.yourRole,
        fellowWolves: null,
        hasAntidote: msg.yourWitchItems && msg.yourWitchItems.hasAntidote,
        hasPoison: msg.yourWitchItems && msg.yourWitchItems.hasPoison,
        players: msg.players,
        nightActionDone: msg.yourNightAction !== null
      });
    } else if (phase === 'DAY') {
      this.showScreen('day', { round: msg.round, players: msg.players });
      if (msg.chatHistory) {
        setTimeout(() => {
          const container = document.getElementById('day-chat-messages');
          if (container) Chat.renderMessages(container, msg.chatHistory, this.playerId);
        }, 100);
      }
    } else if (phase === 'VOTING') {
      this.showScreen('voting', { players: msg.players });
    }
  },

  showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = 'toast ' + (type === 'success' ? 'success' : '');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  },

  reset() {
    this.role = null;
    this.round = 1;
    Timer.reset();
  }
};

// ===== 全局消息路由：所有 WS 消息 → App.routeMessage =====
(function setupGlobalRouter() {
  const messageTypes = [
    'ROOM_CREATED', 'ROOM_JOINED', 'PLAYER_LIST_UPDATE', 'GAME_STARTING',
    'YOUR_ROLE', 'PHASE_CHANGE', 'TIMER_TICK', 'NIGHT_ACTION_ACK',
    'SEER_RESULT', 'NIGHT_RESULT', 'VOTE_TALLY', 'VOTE_RESULT',
    'HUNTER_SHOOT_PROMPT', 'CHAT_MESSAGE', 'GAME_OVER', 'WITCH_TARGET',
    'PLAYER_DISCONNECTED', 'PLAYER_RECONNECTED', 'STATE_SYNC', 'RECONNECT_OK',
    'ERROR'
  ];

  // 用单一处理函数避免重复注册
  const handler = (msg) => { App.routeMessage(msg); };
  messageTypes.forEach(type => { ws.on(type, handler); });
})();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
