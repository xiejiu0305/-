const config = require('./config');
const RoleManager = require('./RoleManager');

const STATE = { WAITING: 'WAITING', NIGHT: 'NIGHT', DAY: 'DAY', VOTING: 'VOTING', END: 'END' };

class GameRoom {
  constructor(code) {
    this.code = code;
    this.players = new Map();        // playerId -> Player
    this.hostId = null;
    this.state = STATE.WAITING;
    this.round = 0;
    this.nightActions = this._emptyNightActions();
    this.votes = new Map();          // voterId -> targetId
    this.chatHistory = [];
    this.deceasedThisRound = [];
    this.timerSeconds = 0;
    this.phaseTimer = null;
    this.tickInterval = null;
    this.disconnectTimeouts = new Map();
  }

  _emptyNightActions() {
    return {
      wolfTargets: new Map(),   // playerId -> targetId (多狼投票)
      seerCheckTarget: null,
      witchSaveUsed: false,     // { targetId }
      witchPoisonTarget: null
    };
  }

  // ===== 玩家管理 =====

  addPlayer(socket, name) {
    const Player = require('./Player');
    const player = new Player(socket, name);
    player.room = this;
    if (this.players.size === 0) {
      player.isHost = true;
      this.hostId = player.id;
    }
    this.players.set(player.id, player);
    return player;
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;
    clearTimeout(this.disconnectTimeouts.get(playerId));
    this.disconnectTimeouts.delete(playerId);
    this.players.delete(playerId);

    // 主机迁移（仅等待阶段）
    if (playerId === this.hostId && this.players.size > 0) {
      const newHost = this.players.values().next().value;
      newHost.isHost = true;
      this.hostId = newHost.id;
    }
    if (this.players.size === 0) {
      this._cleanup();
      return true; // 房间空，需删除
    }
    return false;
  }

  getAlive() {
    return [...this.players.values()].filter(p => p.isAlive);
  }

  getConnected() {
    return [...this.players.values()].filter(p => p.isConnected);
  }

  // ===== 游戏流程 =====

  startGame() {
    const players = [...this.players.values()];
    RoleManager.assignRoles(players);
    this.round = 1;
    this.state = STATE.NIGHT;
    this._startNight();
  }

  _startNight() {
    this.nightActions = this._emptyNightActions();
    this.votes.clear();
    this.deceasedThisRound = [];
    this.players.forEach(p => p.resetRound());

    const publicPlayers = [...this.players.values()].map(p => p.toPublic());

    this._broadcastToAll('PHASE_CHANGE', {
      phase: 'NIGHT',
      round: this.round,
      timerSeconds: config.PHASE_TIMERS.night,
      players: publicPlayers
    });

    this.players.forEach(p => {
      this._sendTo(p.id, 'YOUR_ROLE', this._buildRoleData(p));
    });

    this._startTimer(config.PHASE_TIMERS.night, () => this._advanceToDay());
  }

  _buildRoleData(player) {
    const data = { role: player.role };

    if (player.role === 'WEREWOLF') {
      data.fellowWolves = [...this.players.values()]
        .filter(p => p.role === 'WEREWOLF' && p.id !== player.id)
        .map(p => ({ id: p.id, name: p.name }));
    }
    if (player.role === 'WITCH') {
      data.hasAntidote = player.hasAntidote;
      data.hasPoison = player.hasPoison;
    }

    return data;
  }

  // ===== 夜晚行动记录 =====

  recordNightAction(playerId, action, targetId) {
    const player = this.players.get(playerId);
    if (!player) return false;

    switch (action) {
      case 'kill': {
        // 狼人选刀 — 记录并选多数
        this.nightActions.wolfTargets.set(playerId, targetId);
        // 确定最终狼人目标（多数票）
        const counts = {};
        for (const [_, t] of this.nightActions.wolfTargets) {
          counts[t] = (counts[t] || 0) + 1;
        }
        let maxVotes = 0, finalTarget = null;
        for (const [t, c] of Object.entries(counts)) {
          if (c > maxVotes) { maxVotes = c; finalTarget = t; }
        }
        this.nightActions.werewolfTarget = finalTarget;
        player.nightAction = action;
        player.nightTarget = targetId;
        // 通知女巫狼人选了谁
        this._notifyWitchOfTarget(finalTarget);
        return true;
      }
      case 'check': {
        // 预言家验人
        this.nightActions.seerCheckTarget = targetId;
        player.nightAction = action;
        player.nightTarget = targetId;
        // 告知查验结果
        const target = this.players.get(targetId);
        if (target) {
          const isWolf = target.role === 'WEREWOLF';
          this._sendTo(playerId, 'SEER_RESULT', {
            targetId,
            targetName: target.name,
            isWolf
          });
        }
        return true;
      }
      case 'save': {
        // 女巫救人
        const witch = this.players.get(playerId);
        if (!witch || !witch.hasAntidote) return false;
        this.nightActions.witchSaveUsed = { targetId: this.nightActions.werewolfTarget };
        player.nightAction = action;
        player.nightTarget = this.nightActions.werewolfTarget;
        return true;
      }
      case 'poison': {
        // 女巫毒人
        const witch = this.players.get(playerId);
        if (!witch || !witch.hasPoison) return false;
        this.nightActions.witchPoisonTarget = targetId;
        player.nightAction = action;
        player.nightTarget = targetId;
        return true;
      }
      case 'skip': {
        player.nightAction = 'skip';
        return true;
      }
      default:
        return false;
    }
  }

  _allNightActionsReady() {
    const alive = this.getAlive();
    return alive.every(p => {
      if (p.role === 'WEREWOLF') return p.nightAction !== null;
      if (p.role === 'SEER') return p.nightAction !== null;
      if (p.role === 'WITCH') return p.nightAction !== null;
      if (p.role === 'VILLAGER' || p.role === 'HUNTER') return true; // 无行动
      return true;
    });
  }

  _notifyWitchOfTarget(targetId) {
    const witch = [...this.players.values()].find(p => p.role === 'WITCH' && p.isConnected);
    if (witch && targetId) {
      const target = this.players.get(targetId);
      this._sendTo(witch.id, 'WITCH_TARGET', {
        targetId,
        targetName: target ? target.name : ''
      });
    }
  }

  // ===== 阶段推进 =====

  _advanceToDay() {
    this._clearTimer();
    this.state = STATE.DAY;

    // 结算夜晚
    this.deceasedThisRound = RoleManager.resolveNight(
      this.nightActions, [...this.players.values()]
    );

    // 标记死亡玩家
    this.deceasedThisRound.forEach(id => {
      const p = this.players.get(id);
      if (p) p.die();
    });

    // 发送夜晚结果
    this._broadcastToAll('NIGHT_RESULT', {
      deceased: this.deceasedThisRound.map(id => {
        const p = this.players.get(id);
        return { id, name: p ? p.name : '' };
      }),
      witchSaveUsed: !!this.nightActions.witchSaveUsed,
      witchPoisonUsed: !!this.nightActions.witchPoisonTarget
    });

    // 检查胜负
    const winner = RoleManager.checkWinCondition([...this.players.values()]);
    if (winner) {
      this._endGame(winner);
      return;
    }

    // 处理猎人死亡（夜晚被杀）—— 但猎人在本轮死亡的延迟触发
    const hunterDied = this.deceasedThisRound.some(id => {
      const p = this.players.get(id);
      return p && p.role === 'HUNTER';
    });

    if (hunterDied) {
      const hunterId = this.deceasedThisRound.find(id => {
        const p = this.players.get(id);
        return p && p.role === 'HUNTER';
      });
      this._triggerHunterShoot(hunterId, () => this._startDayPhase());
    } else {
      this._startDayPhase();
    }
  }

  _startDayPhase() {
    // 再检查一次胜负
    const winner = RoleManager.checkWinCondition([...this.players.values()]);
    if (winner) { this._endGame(winner); return; }

    const publicPlayers = [...this.players.values()].map(p => p.toPublic());
    this._broadcastToAll('PHASE_CHANGE', {
      phase: 'DAY',
      round: this.round,
      timerSeconds: config.PHASE_TIMERS.day,
      players: publicPlayers
    });
    this._startTimer(config.PHASE_TIMERS.day, () => this._advanceToVoting());
  }

  skipToVoting() {
    if (this.state !== STATE.DAY) return;
    this._clearTimer();
    this._advanceToVoting();
  }

  _advanceToVoting() {
    this._clearTimer();
    this.state = STATE.VOTING;
    this.votes.clear();
    this.players.forEach(p => { p.votedFor = null; });

    const publicPlayers = [...this.players.values()].map(p => p.toPublic());
    this._broadcastToAll('PHASE_CHANGE', {
      phase: 'VOTING',
      round: this.round,
      timerSeconds: config.PHASE_TIMERS.voting,
      players: publicPlayers
    });
    this._startTimer(config.PHASE_TIMERS.voting, () => this._resolveVotes());
  }

  // ===== 投票 =====

  recordVote(voterId, targetId) {
    const voter = this.players.get(voterId);
    if (!voter || !voter.isAlive) return false;

    voter.votedFor = targetId || 'skip';
    this.votes.set(voterId, targetId || 'skip');

    // 广播计票（匿名）
    this._broadcastVoteTally();

    // 检查是否所有人都投了
    const alive = this.getAlive();
    if (alive.every(p => p.votedFor !== null)) {
      this._clearTimer();
      this._resolveVotes();
    }
    return true;
  }

  _broadcastVoteTally() {
    const tally = {};
    for (const [_, target] of this.votes) {
      tally[target] = (tally[target] || 0) + 1;
    }
    this._broadcastToAll('VOTE_TALLY', {
      tally,
      totalVotes: this.votes.size,
      aliveCount: this.getAlive().length
    });
  }

  _resolveVotes() {
    this._clearTimer();
    const tally = {};
    for (const [_, target] of this.votes) {
      tally[target] = (tally[target] || 0) + 1;
    }

    // 找出得票最多的人
    let maxVotes = 0;
    let eliminated = null;
    let tied = false;

    for (const [target, count] of Object.entries(tally)) {
      if (target === 'skip') continue;
      if (count > maxVotes) {
        maxVotes = count;
        eliminated = target;
        tied = false;
      } else if (count === maxVotes) {
        tied = true;
      }
    }

    if (tied || !eliminated) {
      eliminated = null;
    } else {
      const p = this.players.get(eliminated);
      if (p) p.die();
    }

    const eliminatedPlayer = eliminated ? this.players.get(eliminated) : null;
    const hunterEliminated = eliminatedPlayer && eliminatedPlayer.role === 'HUNTER';

    this._broadcastToAll('VOTE_RESULT', {
      eliminated: eliminatedPlayer ? { id: eliminatedPlayer.id, name: eliminatedPlayer.name } : null,
      tied,
      hunterEliminated
    });

    // 检查胜负
    const winner = RoleManager.checkWinCondition([...this.players.values()]);
    if (winner) {
      this._endGame(winner);
      return;
    }

    // 猎人被投出，触发开枪
    if (hunterEliminated) {
      this._triggerHunterShoot(eliminated, () => this._continueAfterVoting());
    } else {
      this._continueAfterVoting();
    }
  }

  _continueAfterVoting() {
    const winner = RoleManager.checkWinCondition([...this.players.values()]);
    if (winner) { this._endGame(winner); return; }

    this.round++;
    this.state = STATE.NIGHT;
    this._startNight();
  }

  // ===== 猎人开枪 =====

  _triggerHunterShoot(hunterId, callback) {
    const hunter = this.players.get(hunterId);
    if (!hunter) { callback(); return; }

    this._sendTo(hunterId, 'HUNTER_SHOOT_PROMPT', {
      timerSeconds: config.PHASE_TIMERS.hunterShoot,
      alivePlayers: this.getAlive().map(p => p.toPublic())
    });

    let resolved = false;
    const doResolve = (targetId) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);

      if (targetId) {
        const target = this.players.get(targetId);
        if (target && target.isAlive) {
          target.die();
          this._broadcastToAll('CHAT_MESSAGE', {
            playerId: 'system',
            playerName: '系统',
            text: `${hunter.name}（猎人）开枪带走了 ${target.name}`,
            isSystem: true
          });

          // 检查胜负
          const winner = RoleManager.checkWinCondition([...this.players.values()]);
          if (winner) { this._endGame(winner); return; }
        }
      }
      callback();
    };

    const timer = setTimeout(() => doResolve(null), config.PHASE_TIMERS.hunterShoot * 1000);

    // 临时存储 callback，供 hunterShoot 消息处理
    this._hunterCallback = doResolve;
  }

  handleHunterShoot(playerId, targetId) {
    if (this._hunterCallback) {
      this._hunterCallback(targetId);
      this._hunterCallback = null;
    }
  }

  // ===== 聊天 =====

  addChatMessage(playerId, playerName, text, isSystem = false) {
    const msg = { playerId, playerName, text, isSystem, timestamp: Date.now() };
    this.chatHistory.push(msg);
    if (this.chatHistory.length > config.CHAT_MAX_MESSAGES) {
      this.chatHistory.shift();
    }
    this._broadcastToAll('CHAT_MESSAGE', msg);
  }

  // ===== 断线处理 =====

  handleDisconnect(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;

    player.isConnected = false;

    if (this.state === STATE.WAITING) {
      this.removePlayer(playerId);
      this._broadcastPlayerList();
      return;
    }

    if (this.state === STATE.END) return;

    this._broadcastToAll('PLAYER_DISCONNECTED', {
      playerId, playerName: player.name
    });

    // 60 秒重连窗口
    const timeout = setTimeout(() => {
      this._handleDisconnectTimeout(playerId);
    }, config.DISCONNECT_TIMEOUT * 1000);
    this.disconnectTimeouts.set(playerId, timeout);
  }

  handleReconnect(playerId, socket) {
    const player = this.players.get(playerId);
    if (!player) return false;

    clearTimeout(this.disconnectTimeouts.get(playerId));
    this.disconnectTimeouts.delete(playerId);

    player.socket = socket;
    player.isConnected = true;

    // 全量状态同步
    this._sendTo(playerId, 'STATE_SYNC', this._buildStateSync(playerId));

    this._broadcastToAll('PLAYER_RECONNECTED', {
      playerId, playerName: player.name
    });
    return true;
  }

  _handleDisconnectTimeout(playerId) {
    const player = this.players.get(playerId);
    if (!player || player.isConnected) return;
    this.disconnectTimeouts.delete(playerId);

    if (player.isAlive) {
      player.die();
      this._broadcastToAll('CHAT_MESSAGE', {
        playerId: 'system',
        playerName: '系统',
        text: `${player.name} 断线超时，视为死亡`,
        isSystem: true
      });

      const winner = RoleManager.checkWinCondition([...this.players.values()]);
      if (winner) { this._endGame(winner); }
    }
  }

  _buildStateSync(playerId) {
    const player = this.players.get(playerId);
    return {
      state: this.state,
      round: this.round,
      timerSeconds: this.timerSeconds,
      players: [...this.players.values()].map(p => p.toPublic()),
      yourRole: player ? player.role : null,
      yourWitchItems: player ? { hasAntidote: player.hasAntidote, hasPoison: player.hasPoison } : null,
      yourNightAction: player ? player.nightAction : null,
      chatHistory: this.chatHistory.slice(-50),
      deceasedThisRound: this.deceasedThisRound
    };
  }

  // ===== 游戏结束 =====

  _endGame(winner) {
    this._clearTimer();
    this.state = STATE.END;
    this._broadcastToAll('GAME_OVER', {
      winner,
      players: [...this.players.values()].map(p => p.toRoleReveal())
    });
  }

  // ===== 计时器 =====

  _startTimer(seconds, callback) {
    this.timerSeconds = seconds;
    this._broadcastTimerTick();

    this.tickInterval = setInterval(() => {
      this.timerSeconds--;
      this._broadcastTimerTick();
      if (this.timerSeconds <= 0) {
        clearInterval(this.tickInterval);
        this.tickInterval = null;
      }
    }, 1000);

    this.phaseTimer = setTimeout(() => {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
      callback();
    }, seconds * 1000);
  }

  _broadcastTimerTick() {
    this._broadcastToAll('TIMER_TICK', { secondsRemaining: this.timerSeconds });
  }

  _clearTimer() {
    if (this.phaseTimer) { clearTimeout(this.phaseTimer); this.phaseTimer = null; }
    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
  }

  _cleanup() {
    this._clearTimer();
    this.disconnectTimeouts.forEach(t => clearTimeout(t));
    this.disconnectTimeouts.clear();
  }

  // ===== 通信 =====

  _broadcastToAll(type, data) {
    const msg = JSON.stringify({ type, ...data });
    this.players.forEach(p => {
      if (p.isConnected && p.socket && p.socket.readyState === 1) {
        try { p.socket.send(msg); } catch (e) { /* ignore */ }
      }
    });
  }

  _sendTo(playerId, type, data) {
    const player = this.players.get(playerId);
    if (!player || !player.isConnected) return;
    const msg = JSON.stringify({ type, ...data });
    try { player.socket.send(msg); } catch (e) { /* ignore */ }
  }

  _broadcastPlayerList() {
    this._broadcastToAll('PLAYER_LIST_UPDATE', {
      players: [...this.players.values()].map(p => p.toPublic())
    });
  }

  broadcastPlayerList() {
    this._broadcastPlayerList();
  }
}

GameRoom.STATE = STATE;
module.exports = GameRoom;
