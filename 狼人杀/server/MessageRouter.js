const config = require('./config');

/**
 * 中央消息分发器 — 路由收到的 WebSocket 消息到对应处理器
 */
class MessageRouter {
  constructor() {
    this.rooms = new Map(); // roomCode -> GameRoom
  }

  /**
   * 处理客户端消息
   * @param {WebSocket} socket
   * @param {object} msg - 已解析的 JSON 消息
   */
  handle(socket, msg) {
    switch (msg.type) {
      case 'CREATE_ROOM':
        this._createRoom(socket, msg);
        break;
      case 'JOIN_ROOM':
        this._joinRoom(socket, msg);
        break;
      case 'LEAVE_ROOM':
        this._leaveRoom(socket, msg);
        break;
      case 'START_GAME':
        this._startGame(socket, msg);
        break;
      case 'NIGHT_ACTION':
        this._nightAction(socket, msg);
        break;
      case 'VOTE':
        this._vote(socket, msg);
        break;
      case 'CHAT_MESSAGE':
        this._chatMessage(socket, msg);
        break;
      case 'HUNTER_SHOOT':
        this._hunterShoot(socket, msg);
        break;
      case 'SKIP_VOTE':
      case 'SKIP_TO_VOTING':
        this._skipToVoting(socket, msg);
        break;
      case 'RECONNECT':
        this._reconnect(socket, msg);
        break;
      default:
        this._sendError(socket, 'UNKNOWN_TYPE', '未知消息类型');
    }
  }

  /**
   * 处理断线
   */
  handleDisconnect(socket) {
    // 查找该 socket 关联的玩家和房间
    for (const [code, room] of this.rooms) {
      for (const [pid, player] of room.players) {
        if (player.socket === socket) {
          const isEmpty = room.handleDisconnect(pid);
          if (isEmpty) this.rooms.delete(code);
          return;
        }
      }
    }
  }

  // ===== 消息处理器 =====

  _createRoom(socket, msg) {
    const name = (msg.playerName || '').trim();
    if (!name || name.length < 2 || name.length > 12) {
      return this._sendError(socket, 'INVALID_NAME', '昵称需 2-12 个字符');
    }

    const GameRoom = require('./GameRoom');
    const { generateRoomCode } = require('./utils');

    // 生成不重复的房间码
    let code;
    do { code = generateRoomCode(); } while (this.rooms.has(code));

    const room = new GameRoom(code);
    const player = room.addPlayer(socket, name);
    this.rooms.set(code, room);

    this._send(socket, 'ROOM_CREATED', {
      roomCode: code,
      playerId: player.id
    });

    room.broadcastPlayerList();
  }

  _joinRoom(socket, msg) {
    const name = (msg.playerName || '').trim();
    const roomCode = (msg.roomCode || '').toUpperCase().trim();

    if (!name || name.length < 2 || name.length > 12) {
      return this._sendError(socket, 'INVALID_NAME', '昵称需 2-12 个字符');
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      return this._sendError(socket, 'ROOM_NOT_FOUND', '房间不存在');
    }
    if (room.state !== 'WAITING') {
      return this._sendError(socket, 'GAME_IN_PROGRESS', '游戏已开始，无法加入');
    }
    if (room.players.size >= config.MAX_PLAYERS) {
      return this._sendError(socket, 'ROOM_FULL', '房间已满');
    }
    // 检查重名
    for (const [_, p] of room.players) {
      if (p.name === name) {
        return this._sendError(socket, 'DUPLICATE_NAME', '房间内已有同名玩家');
      }
    }

    const player = room.addPlayer(socket, name);

    this._send(socket, 'ROOM_JOINED', {
      roomCode: room.code,
      playerId: player.id
    });

    room.broadcastPlayerList();
  }

  _leaveRoom(socket, msg) {
    const { room, playerId } = this._findPlayer(socket, msg);
    if (!room) return;
    const isEmpty = room.removePlayer(playerId);
    if (isEmpty) {
      this.rooms.delete(room.code);
    } else {
      room.broadcastPlayerList();
    }
  }

  _startGame(socket, msg) {
    const { room, playerId } = this._findPlayer(socket, msg);
    if (!room) return;
    if (playerId !== room.hostId) {
      return this._sendError(socket, 'NOT_HOST', '只有房主可以开始游戏');
    }
    if (room.players.size < config.MIN_PLAYERS) {
      return this._sendError(socket, 'NOT_ENOUGH_PLAYERS', `至少需要 ${config.MIN_PLAYERS} 名玩家`);
    }
    if (![...room.players.values()].every(p => p.isConnected)) {
      return this._sendError(socket, 'PLAYER_DISCONNECTED', '有玩家已断线，请等待重连');
    }

    room.startGame();
  }

  _nightAction(socket, msg) {
    const { room, player } = this._findPlayer(socket, msg);
    if (!room || !player) return;
    if (room.state !== 'NIGHT') return;

    const ok = room.recordNightAction(player.id, msg.action, msg.targetId);
    if (!ok) {
      return this._sendError(socket, 'INVALID_ACTION', '行动无效');
    }

    this._send(socket, 'NIGHT_ACTION_ACK', { action: msg.action, targetId: msg.targetId });

    // 检查是否所有人都完成了行动
    if (room._allNightActionsReady()) {
      room._clearTimer();
      room._advanceToDay();
    }
  }

  _vote(socket, msg) {
    const { room, player } = this._findPlayer(socket, msg);
    if (!room || !player) return;
    if (room.state !== 'VOTING') return;
    if (!player.isAlive) return;

    room.recordVote(player.id, msg.targetId);
    this._send(socket, 'VOTE_ACK', { targetId: msg.targetId });
  }

  _chatMessage(socket, msg) {
    const { room, player } = this._findPlayer(socket, msg);
    if (!room || !player) return;
    const text = (msg.text || '').trim();
    if (!text || text.length > 200) return;

    // 死人白天不能发消息（允许系统消息）
    if (!player.isAlive && (room.state === 'DAY' || room.state === 'VOTING')) {
      return;
    }

    room.addChatMessage(player.id, player.name, text);
  }

  _hunterShoot(socket, msg) {
    const { room, player } = this._findPlayer(socket, msg);
    if (!room || !player) return;
    room.handleHunterShoot(player.id, msg.targetId);
  }

  _skipToVoting(socket, msg) {
    const { room, playerId } = this._findPlayer(socket, msg);
    if (!room) return;
    if (playerId !== room.hostId) return;
    room.skipToVoting();
  }

  _reconnect(socket, msg) {
    const roomCode = (msg.roomCode || '').toUpperCase().trim();
    const playerId = msg.playerId;
    const room = this.rooms.get(roomCode);
    if (!room) {
      return this._sendError(socket, 'RECONNECT_FAILED', '房间不存在');
    }

    const ok = room.handleReconnect(playerId, socket);
    if (!ok) {
      return this._sendError(socket, 'RECONNECT_FAILED', '重连失败，玩家不在房间内');
    }

    this._send(socket, 'RECONNECT_OK', { playerId, roomCode });
  }

  // ===== 辅助 =====

  _findPlayer(socket, msg) {
    const { roomCode, playerId } = msg;
    const room = this.rooms.get(roomCode);
    if (!room) return { room: null, player: null, playerId: null };
    const player = room.players.get(playerId);
    if (!player || player.socket !== socket) return { room, player: null, playerId };
    return { room, player, playerId };
  }

  _send(socket, type, data) {
    if (socket.readyState === 1) {
      try { socket.send(JSON.stringify({ type, ...data })); } catch (e) { /* ignore */ }
    }
  }

  _sendError(socket, code, message) {
    this._send(socket, 'ERROR', { code, message });
  }
}

module.exports = MessageRouter;
