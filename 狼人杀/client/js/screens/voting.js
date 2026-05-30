/**
 * Voting 屏幕：投票淘汰 / 猎人开枪
 */
const VotingScreen = {
  players: [],
  selectedTarget: null,
  hasVoted: false,
  isHunterShoot: false,
  hunterTimerSeconds: 0,

  setup(data) {
    this.isHunterShoot = data.hunterShoot || false;
    this.players = data.players || data.alivePlayers || [];
    this.selectedTarget = null;
    this.hasVoted = false;
    this.hunterTimerSeconds = data.timerSeconds || 0;

    const header = document.querySelector('#screen-voting .voting-title');
    const grid = document.getElementById('voting-grid');
    const skipBtn = document.getElementById('btn-skip-vote');
    const tallyContainer = document.getElementById('vote-tally');

    tallyContainer.style.display = 'none';

    if (this.isHunterShoot) {
      header.textContent = '🏹 猎人死亡 — 请选择开枪目标';
      skipBtn.style.display = 'none';
    } else {
      header.textContent = '🗳️ 投票时间 — 选出你认为是狼人的玩家';
      skipBtn.style.display = 'inline-flex';
    }

    this.renderGrid(grid);

    skipBtn.onclick = () => {
      if (this.hasVoted) return;
      this.hasVoted = true;
      ws.send('VOTE', {
        roomCode: App.roomCode,
        playerId: App.playerId,
        targetId: 'skip'
      });
      this.disableGrid();
    };
  },

  renderGrid(grid) {
    grid.innerHTML = '';

    const targets = this.players.filter(p =>
      p.isAlive && p.id !== App.playerId
    );

    if (targets.length === 0) {
      grid.innerHTML = '<p style="text-align:center;grid-column:1/-1;color:var(--day-text-dim);">没有可投票的玩家</p>';
      return;
    }

    // 使用 PlayerList.render 一次性渲染，避免重复监听器
    PlayerList.render(grid, targets, {
      showDead: false,
      selectable: !this.hasVoted,
      selectedId: this.selectedTarget,
      onClick: (id) => {
        if (this.hasVoted) return;
        this.selectedTarget = id;

        if (this.isHunterShoot) {
          this.hasVoted = true;
          ws.send('HUNTER_SHOOT', {
            roomCode: App.roomCode,
            playerId: App.playerId,
            targetId: id
          });
          this.disableGrid();
        } else {
          this.hasVoted = true;
          ws.send('VOTE', {
            roomCode: App.roomCode,
            playerId: App.playerId,
            targetId: id
          });
          this.disableGrid();
        }
      }
    });
  },

  disableGrid() {
    const grid = document.getElementById('voting-grid');
    const cards = grid.querySelectorAll('.player-card');
    cards.forEach(c => {
      c.style.pointerEvents = 'none';
      c.style.opacity = c.classList.contains('selected') ? '1' : '0.5';
    });
    const skipBtn = document.getElementById('btn-skip-vote');
    if (skipBtn) skipBtn.style.display = 'none';
  },

  handleMessage(msg) {
    switch (msg.type) {
      case 'VOTE_TALLY':
        this.renderTally(msg);
        break;

      case 'VOTE_RESULT':
        this.renderResult(msg);
        break;

      case 'PHASE_CHANGE':
        if (msg.phase === 'NIGHT') {
          App.showScreen('night', { phase: 'NIGHT', round: msg.round, players: this.players });
        }
        break;

      case 'GAME_OVER':
        App.showScreen('result', msg);
        break;

      case 'CHAT_MESSAGE':
        // 投票阶段也可以看到系统消息
        if (msg.isSystem) {
          App.showToast(msg.text);
        }
        break;
    }
  },

  renderTally(msg) {
    const container = document.getElementById('vote-tally');
    container.style.display = 'block';
    container.innerHTML = '<h4 style="margin-bottom:8px;">当前投票情况</h4>';

    const maxVotes = Math.max(1, ...Object.values(msg.tally));

    for (const [targetId, count] of Object.entries(msg.tally)) {
      const row = document.createElement('div');
      row.className = 'vote-tally-item';

      const nameEl = document.createElement('span');
      nameEl.className = 'vote-tally-name';
      if (targetId === 'skip') {
        nameEl.textContent = '弃权';
      } else {
        const player = this.players.find(p => p.id === targetId);
        nameEl.textContent = player ? player.name : targetId;
      }

      const barEl = document.createElement('div');
      barEl.className = 'vote-tally-bar';
      barEl.style.width = (count / maxVotes * 60) + '%';

      const countEl = document.createElement('span');
      countEl.className = 'vote-tally-count';
      countEl.textContent = count + '票';

      row.appendChild(nameEl);
      row.appendChild(barEl);
      row.appendChild(countEl);
      container.appendChild(row);
    }
  },

  renderResult(msg) {
    const container = document.getElementById('vote-tally');
    container.style.display = 'block';

    if (msg.tied) {
      container.innerHTML += `
        <p style="text-align:center;margin-top:16px;font-size:18px;font-weight:700;color:var(--gold);">
          ⚖️ 平票！无人被淘汰
        </p>
      `;
    } else if (msg.eliminated) {
      container.innerHTML += `
        <p style="text-align:center;margin-top:16px;font-size:18px;font-weight:700;color:var(--day-accent);">
          🗳️ ${msg.eliminated.name} 被投票淘汰
        </p>
      `;
      // 高亮被淘汰的卡片
      const cards = document.querySelectorAll('#voting-grid .player-card');
      cards.forEach(card => {
        const nameEl = card.querySelector('.player-name');
        if (nameEl && nameEl.textContent === msg.eliminated.name) {
          card.classList.add('eliminated');
        }
      });
    } else {
      container.innerHTML += `
        <p style="text-align:center;margin-top:16px;font-size:18px;font-weight:700;color:var(--gold);">
          无人被淘汰
        </p>
      `;
    }

    // 不显示继续按钮——等待服务器推进阶段
  }
};
