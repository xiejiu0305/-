class Player {
  constructor(socket, name) {
    this.id = require('./utils').generatePlayerId();
    this.name = name;
    this.socket = socket;
    this.role = null;          // 'WEREWOLF' | 'VILLAGER' | 'SEER' | 'WITCH' | 'HUNTER'
    this.isAlive = true;
    this.isHost = false;
    this.isConnected = true;
    // 女巫道具
    this.hasAntidote = true;
    this.hasPoison = true;
    // 当前轮投票
    this.votedFor = null;
    // 夜晚行动
    this.nightAction = null;
    this.nightTarget = null;
    // 所属房间
    this.room = null;
  }

  toPublic() {
    return {
      id: this.id,
      name: this.name,
      isHost: this.isHost,
      isAlive: this.isAlive,
      isConnected: this.isConnected
    };
  }

  toRoleReveal() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      isAlive: this.isAlive
    };
  }

  resetRound() {
    this.votedFor = null;
    this.nightAction = null;
    this.nightTarget = null;
  }

  die() {
    this.isAlive = false;
  }
}

module.exports = Player;
