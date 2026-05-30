/**
 * 角色翻牌组件：用于结算时展示身份
 */
const RoleCard = {
  /**
   * 创建一张可翻牌的角色卡片
   */
  create(player, delayMs = 0) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.style.animationDelay = delayMs + 'ms';

    const inner = document.createElement('div');
    inner.className = 'result-card-inner';

    // 正面 - 问号
    const front = document.createElement('div');
    front.className = 'result-card-front';
    front.innerHTML = '<span style="font-size:32px;">?</span>';

    // 背面 - 角色信息
    const back = document.createElement('div');
    back.className = 'result-card-back';
    const faction = player.role === 'WEREWOLF' ? 'werewolf' : 'villager';
    back.classList.add(faction);

    const emoji = PlayerList.getRoleEmoji(player.role);
    const roleName = PlayerList.getRoleName(player.role);
    back.innerHTML = `
      <div style="font-size:40px;">${emoji}</div>
      <div style="font-size:18px;font-weight:700;margin-top:4px;">${roleName}</div>
      <div style="font-size:14px;margin-top:8px;color:var(--night-text-dim);">${player.name}</div>
      <div style="font-size:12px;margin-top:4px;color:${player.isAlive ? 'var(--day-life)' : 'var(--day-accent)'};">
        ${player.isAlive ? '存活' : '死亡'}
      </div>
    `;

    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);

    // 延迟翻牌
    setTimeout(() => {
      card.classList.add('flipped');
    }, delayMs);

    return card;
  }
};
