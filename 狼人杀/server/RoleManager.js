const config = require('./config');

class RoleManager {
  /**
   * 根据总人数返回角色数组
   */
  static buildRolePool(total) {
    const dist = config.getRoleDistribution(total);
    const pool = [];
    for (let i = 0; i < dist.werewolves; i++) pool.push('WEREWOLF');
    for (let i = 0; i < dist.villagers; i++) pool.push('VILLAGER');
    pool.push('SEER');
    pool.push('WITCH');
    pool.push('HUNTER');
    return pool;
  }

  /**
   * 将角色随机分配给玩家列表
   */
  static assignRoles(players) {
    const { shuffle } = require('./utils');
    const pool = shuffle(this.buildRolePool(players.length));
    const result = {};
    players.forEach((player, i) => {
      player.role = pool[i];
      if (player.role === 'WITCH') {
        player.hasAntidote = true;
        player.hasPoison = true;
      }
      result[player.id] = pool[i];
    });
    return result;
  }

  /**
   * 结算夜晚行动，返回死亡玩家 ID 列表
   */
  static resolveNight(nightActions, players) {
    const deadThisRound = [];
    const playerMap = {};
    players.forEach(p => { playerMap[p.id] = p; });

    const { werewolfTarget, witchSaveUsed, witchPoisonTarget } = nightActions;

    // 1. 狼人选目标
    if (werewolfTarget && playerMap[werewolfTarget] && playerMap[werewolfTarget].isAlive) {
      if (!witchSaveUsed || witchSaveUsed.targetId !== werewolfTarget) {
        // 女巫没救
        deadThisRound.push(werewolfTarget);
      }
    }

    // 2. 女巫毒药
    if (witchPoisonTarget && playerMap[witchPoisonTarget] && playerMap[witchPoisonTarget].isAlive) {
      if (!deadThisRound.includes(witchPoisonTarget)) {
        deadThisRound.push(witchPoisonTarget);
      }
    }

    // 3. 消耗女巫道具
    if (witchSaveUsed) {
      const witch = players.find(p => p.role === 'WITCH');
      if (witch) witch.hasAntidote = false;
    }
    if (witchPoisonTarget) {
      const witch = players.find(p => p.role === 'WITCH');
      if (witch) witch.hasPoison = false;
    }

    return deadThisRound;
  }

  /**
   * 检查胜负。返回 'villagers' | 'werewolves' | null
   */
  static checkWinCondition(players) {
    const aliveWolves = players.filter(p => p.isAlive && p.role === 'WEREWOLF').length;
    const aliveVillagers = players.filter(p => p.isAlive && p.role !== 'WEREWOLF').length;

    if (aliveWolves === 0) return 'villagers';
    if (aliveWolves >= aliveVillagers) return 'werewolves';
    return null;
  }
}

module.exports = RoleManager;
