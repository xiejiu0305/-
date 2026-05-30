/**
 * Result 屏幕：胜负宣告 + 身份揭晓
 */
const ResultScreen = {
  setup(data) {
    const winner = data.winner;
    const players = data.players || [];
    const round = data.round || App.round || 0;

    // 胜负文案
    const winnerEl = document.getElementById('result-winner-text');
    if (winner === 'villagers') {
      winnerEl.textContent = '🎉 好人阵营获胜！';
      winnerEl.className = 'result-winner villagers';
    } else {
      winnerEl.textContent = '🐺 狼人阵营获胜！';
      winnerEl.className = 'result-winner werewolves';
    }

    document.getElementById('result-round-text').textContent = `共进行了 ${round} 轮`;

    // 渲染角色卡片
    const container = document.getElementById('result-roles');
    container.innerHTML = '';

    // 胜利阵营放在前面
    const sorted = [...players].sort((a, b) => {
      const aWinner = winner === 'werewolves' ? a.role === 'WEREWOLF' : a.role !== 'WEREWOLF';
      const bWinner = winner === 'werewolves' ? b.role === 'WEREWOLF' : b.role !== 'WEREWOLF';
      if (aWinner && !bWinner) return -1;
      if (!aWinner && bWinner) return 1;
      return 0;
    });

    sorted.forEach((player, i) => {
      const card = RoleCard.create(player, i * 200);
      container.appendChild(card);
    });

    // 胜利时放彩纸
    if (winner) {
      this._spawnConfetti();
    }

    // 再来一局
    document.getElementById('btn-play-again').onclick = () => {
      ws.send('LEAVE_ROOM', { roomCode: App.roomCode, playerId: App.playerId });
      App.reset();
      App.showScreen('home');
    };
  },

  handleMessage(msg) {
    // 结果屏幕不需要处理消息
  },

  _spawnConfetti() {
    const colors = ['#ff0', '#f0f', '#0ff', '#f00', '#0f0', '#00f', '#ffa500', '#ff69b4'];
    for (let i = 0; i < 60; i++) {
      setTimeout(() => {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = (2 + Math.random() * 3) + 's';
        piece.style.animationDelay = Math.random() * 0.5 + 's';
        piece.style.width = (6 + Math.random() * 10) + 'px';
        piece.style.height = (6 + Math.random() * 10) + 'px';
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        document.body.appendChild(piece);

        setTimeout(() => piece.remove(), 4000);
      }, i * 30);
    }
  }
};
