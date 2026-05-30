/**
 * 玩家列表组件：渲染玩家卡片网格
 */
const PlayerList = {
  COLORS: ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c',
           '#e91e63', '#00bcd4', '#ff5722', '#3f51b5', '#8bc34a', '#ff9800'],

  /**
   * 根据名字分配颜色
   */
  getColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return this.COLORS[Math.abs(hash) % this.COLORS.length];
  },

  /**
   * 获取角色中文名
   */
  getRoleName(role) {
    const map = {
      'WEREWOLF': '狼人',
      'VILLAGER': '村民',
      'SEER': '预言家',
      'WITCH': '女巫',
      'HUNTER': '猎人'
    };
    return map[role] || '未知';
  },

  /**
   * 获取角色 Emoji
   */
  getRoleEmoji(role) {
    const map = {
      'WEREWOLF': '🐺',
      'VILLAGER': '👨‍🌾',
      'SEER': '🔮',
      'WITCH': '🧪',
      'HUNTER': '🏹'
    };
    return map[role] || '❓';
  },

  /**
   * 渲染玩家卡片到容器
   * @param {HTMLElement} container
   * @param {Array} players - [{id, name, isHost, isAlive, isConnected, role?}]
   * @param {object} opts
   *   - selectable: bool - 是否可选
   *   - selectedId: string - 当前选中 ID
   *   - onClick: function(playerId) - 点击回调
   *   - showDead: bool - 是否显示死者
   *   - excludeIds: string[] - 排除的玩家 ID
   */
  render(container, players, opts = {}) {
    container.innerHTML = '';
    const filtered = players.filter(p => {
      if (opts.excludeIds && opts.excludeIds.includes(p.id)) return false;
      if (!opts.showDead && !p.isAlive) return false;
      return true;
    });

    filtered.forEach(p => {
      const card = document.createElement('div');
      card.className = 'player-card';
      if (!p.isAlive) card.classList.add('dead');
      if (!p.isConnected) card.classList.add('disconnected');
      if (opts.selectedId === p.id) card.classList.add('selected');

      if (opts.selectable && p.isAlive && p.isConnected) {
        card.addEventListener('click', () => {
          if (opts.onClick) opts.onClick(p.id);
        });
      }

      const avatar = document.createElement('div');
      avatar.className = 'player-avatar';
      avatar.style.background = this.getColor(p.name);
      avatar.textContent = p.name.charAt(0).toUpperCase();

      const name = document.createElement('div');
      name.className = 'player-name';
      name.textContent = p.name;

      card.appendChild(avatar);
      card.appendChild(name);

      // 徽章
      if (p.isHost) {
        const badge = document.createElement('div');
        badge.className = 'player-badge host';
        badge.textContent = '👑 房主';
        card.appendChild(badge);
      }
      if (p.role !== undefined && p.role !== null) {
        const badge = document.createElement('div');
        badge.className = 'player-badge ' + (p.isAlive ? 'alive' : 'dead');
        badge.textContent = this.getRoleEmoji(p.role) + ' ' + this.getRoleName(p.role);
        card.appendChild(badge);
      } else if (!p.isConnected) {
        const badge = document.createElement('div');
        badge.className = 'player-badge disconnected';
        badge.textContent = '已断线';
        card.appendChild(badge);
      } else if (p.isAlive) {
        const badge = document.createElement('div');
        badge.className = 'player-badge alive';
        badge.textContent = '存活';
        card.appendChild(badge);
      } else {
        const badge = document.createElement('div');
        badge.className = 'player-badge dead';
        badge.textContent = '💀 已死亡';
        card.appendChild(badge);
      }

      container.appendChild(card);
    });
  }
};
