/**
 * Night 屏幕：夜晚各角色行动
 */
const NightScreen = {
  role: null,
  roleData: {},
  selectedTarget: null,
  seerResult: null,
  nightActionDone: false,
  players: [],

  setup(data) {
    this.role = data.role || null;
    this.roleData = data;
    this.selectedTarget = null;
    this.seerResult = null;
    this.nightActionDone = data.nightActionDone || false;
    this.players = data.players || [];

    const titleEl = document.getElementById('night-role-title');
    const descEl = document.getElementById('night-role-desc');
    const areaEl = document.getElementById('night-action-area');

    const roleNames = {
      'WEREWOLF': '狼人 — 请睁眼选择目标',
      'SEER': '预言家 — 请查验一名玩家身份',
      'WITCH': '女巫 — 请决定是否使用药水',
      'HUNTER': '猎人 — 夜晚请闭眼等待',
      'VILLAGER': '村民 — 夜晚请闭眼等待'
    };
    titleEl.textContent = roleNames[this.role] || '天黑请闭眼';
    descEl.textContent = `第 ${App.round || 1} 夜`;

    if (this.role) {
      this.renderRolePanel(areaEl);
    } else {
      // 角色信息尚未到达，显示等待状态
      areaEl.innerHTML = `
        <div class="night-playing">
          <div class="night-moon">🌙</div>
          <div class="night-wait-text">正在获取身份信息...</div>
        </div>
      `;
    }
  },

  renderRolePanel(container) {
    container.innerHTML = '';

    if (!this.role) {
      container.innerHTML = `
        <div class="night-playing">
          <div class="night-moon">🌙</div>
          <div class="night-wait-text">正在获取身份信息...</div>
        </div>
      `;
      return;
    }

    if (this.role === 'WEREWOLF') {
      this._renderWerewolfPanel(container);
    } else if (this.role === 'SEER') {
      this._renderSeerPanel(container);
    } else if (this.role === 'WITCH') {
      this._renderWitchPanel(container);
    } else {
      this._renderSleepPanel(container);
    }
  },

  _renderWerewolfPanel(container) {
    if (this.roleData.fellowWolves && this.roleData.fellowWolves.length > 0) {
      const fellowDiv = document.createElement('div');
      fellowDiv.style.cssText = 'text-align:center;margin-bottom:16px;color:var(--night-text-dim);font-size:14px;';
      fellowDiv.textContent = '🐺 队友：' + this.roleData.fellowWolves.map(w => w.name).join('、');
      container.appendChild(fellowDiv);
    }

    const grid = document.createElement('div');
    grid.className = 'player-grid';
    grid.id = 'night-player-grid';

    const targets = (this.players || []).filter(p =>
      p.isAlive && p.role !== 'WEREWOLF'
    );

    PlayerList.render(grid, targets, {
      showDead: false,
      selectable: !this.nightActionDone,
      selectedId: this.selectedTarget,
      onClick: (id) => {
        if (this.nightActionDone) return;
        this.selectedTarget = id;
        this._renderWerewolfPanel(container);
      }
    });

    container.appendChild(grid);

    if (this.selectedTarget && !this.nightActionDone) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-danger btn-block';
      btn.style.cssText = 'margin-top:16px;';
      btn.textContent = '确认击杀目标';
      btn.onclick = () => {
        this.nightActionDone = true;
        ws.send('NIGHT_ACTION', {
          roomCode: App.roomCode,
          playerId: App.playerId,
          action: 'kill',
          targetId: this.selectedTarget
        });
        this._showWaiting(container);
      };
      container.appendChild(btn);
    } else if (this.nightActionDone) {
      this._showWaiting(container);
    }
  },

  _renderSeerPanel(container) {
    if (this.nightActionDone && this.seerResult) {
      this._showSeerResult(container);
      return;
    }

    if (this.nightActionDone) {
      this._showWaiting(container);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'player-grid';
    grid.id = 'night-player-grid';

    const targets = (this.players || []).filter(p =>
      p.isAlive && p.id !== App.playerId
    );

    PlayerList.render(grid, targets, {
      showDead: false,
      selectable: true,
      selectedId: this.selectedTarget,
      onClick: (id) => {
        if (this.nightActionDone) return;
        this.selectedTarget = id;
        this.nightActionDone = true;
        ws.send('NIGHT_ACTION', {
          roomCode: App.roomCode,
          playerId: App.playerId,
          action: 'check',
          targetId: id
        });
      }
    });

    container.appendChild(grid);
  },

  _showSeerResult(container) {
    const target = (this.players || []).find(p => p.id === this.seerResult.targetId);
    container.innerHTML = '';

    const resultDiv = document.createElement('div');
    resultDiv.style.cssText = 'text-align:center;padding:40px;';

    const emoji = this.seerResult.isWolf ? '🐺' : '😇';
    const label = this.seerResult.isWolf ? '狼人！' : '好人';
    const color = this.seerResult.isWolf ? 'var(--day-accent)' : 'var(--day-life)';

    resultDiv.innerHTML = `
      <div style="font-size:64px;margin-bottom:16px;">${emoji}</div>
      <div style="font-size:22px;font-weight:700;color:${color};">${this.seerResult.targetName} 是${label}</div>
      <p style="color:var(--night-text-dim);margin-top:12px;">等待天亮...</p>
    `;
    container.appendChild(resultDiv);
  },

  _renderWitchPanel(container) {
    const hasAntidote = this.roleData.hasAntidote !== false;
    const hasPoison = this.roleData.hasPoison !== false;
    const werewolfTarget = this.roleData.werewolfTarget;

    if (this.nightActionDone) {
      this._showWaiting(container);
      return;
    }

    if (werewolfTarget) {
      const target = (this.players || []).find(p => p.id === werewolfTarget);
      const info = document.createElement('div');
      info.style.cssText = 'text-align:center;background:rgba(204,51,51,0.15);border-radius:var(--radius-lg);padding:20px;margin-bottom:20px;';
      info.innerHTML = `
        <div style="font-size:14px;color:var(--night-text-dim);">今晚狼人袭击了</div>
        <div style="font-size:22px;font-weight:700;color:var(--day-accent);margin-top:4px;">${target ? target.name : '未知'}</div>
      `;
      container.appendChild(info);
    } else {
      const info = document.createElement('div');
      info.style.cssText = 'text-align:center;padding:20px;margin-bottom:20px;color:var(--night-text-dim);';
      info.textContent = '等待狼人选目标...';
      container.appendChild(info);
    }

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center;';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = '💚 使用解药救人';
    saveBtn.disabled = !hasAntidote || !werewolfTarget;
    if (!hasAntidote) saveBtn.textContent = '解药已使用';
    saveBtn.onclick = () => {
      this.nightActionDone = true;
      ws.send('NIGHT_ACTION', {
        roomCode: App.roomCode,
        playerId: App.playerId,
        action: 'save'
      });
      this._showWaiting(container);
    };
    btnRow.appendChild(saveBtn);

    const skipSaveBtn = document.createElement('button');
    skipSaveBtn.className = 'btn btn-secondary';
    skipSaveBtn.textContent = '不救人';
    skipSaveBtn.onclick = () => {
      this._renderPoisonSection(container, hasPoison);
    };
    btnRow.appendChild(skipSaveBtn);

    container.appendChild(btnRow);
  },

  _renderPoisonSection(container, hasPoison) {
    const existed = container.querySelector('.poison-section');
    if (existed) existed.remove();

    const section = document.createElement('div');
    section.className = 'poison-section';
    section.style.cssText = 'margin-top:20px;';

    if (!hasPoison) {
      section.innerHTML = '<p style="text-align:center;color:var(--night-text-dim);">毒药已使用</p>';
      container.appendChild(section);
      this.nightActionDone = true;
      ws.send('NIGHT_ACTION', { roomCode: App.roomCode, playerId: App.playerId, action: 'skip' });
      this._showWaiting(container);
      return;
    }

    const title = document.createElement('p');
    title.style.cssText = 'text-align:center;margin-bottom:12px;';
    title.textContent = '是否使用毒药？';
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'player-grid';

    const targets = (this.players || []).filter(p =>
      p.isAlive && p.id !== App.playerId
    );

    PlayerList.render(grid, targets, {
      showDead: false,
      selectable: true,
      selectedId: this.selectedTarget,
      onClick: (id) => {
        this.selectedTarget = id;
        this._renderPoisonSection(container, hasPoison);
      }
    });
    section.appendChild(grid);

    if (this.selectedTarget) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-danger btn-block';
      btn.style.cssText = 'margin-top:12px;';
      btn.textContent = '☠️ 使用毒药毒杀';
      btn.onclick = () => {
        this.nightActionDone = true;
        ws.send('NIGHT_ACTION', {
          roomCode: App.roomCode,
          playerId: App.playerId,
          action: 'poison',
          targetId: this.selectedTarget
        });
        this._showWaiting(container);
      };
      section.appendChild(btn);
    }

    const skipPoisonBtn = document.createElement('button');
    skipPoisonBtn.className = 'btn btn-secondary btn-block';
    skipPoisonBtn.style.cssText = 'margin-top:8px;';
    skipPoisonBtn.textContent = '跳过毒药';
    skipPoisonBtn.onclick = () => {
      this.nightActionDone = true;
      ws.send('NIGHT_ACTION', { roomCode: App.roomCode, playerId: App.playerId, action: 'skip' });
      this._showWaiting(container);
    };
    section.appendChild(skipPoisonBtn);

    container.appendChild(section);
  },

  _renderSleepPanel(container) {
    container.innerHTML = `
      <div class="night-playing">
        <div class="night-moon">🌙</div>
        <div class="night-wait-text">夜晚降临，请闭眼等待...</div>
        <p style="color:var(--night-text-dim);font-size:12px;">
          ${this.role === 'HUNTER' ? '你是猎人，天亮后如被杀害可开枪带走一人' : '你是村民，天亮后参与讨论和投票'}
        </p>
      </div>
    `;
  },

  _showWaiting(container) {
    container.innerHTML = `
      <div class="night-playing">
        <div class="night-moon">⏳</div>
        <div class="night-wait-text">行动已提交，等待其他玩家...</div>
      </div>
    `;
  },

  handleMessage(msg) {
    switch (msg.type) {
      case 'SEER_RESULT':
        this.seerResult = msg;
        const area = document.getElementById('night-action-area');
        this._showSeerResult(area);
        break;

      case 'NIGHT_ACTION_ACK':
        break;

      case 'WITCH_TARGET':
        this.roleData.werewolfTarget = msg.targetId;
        this.roleData.werewolfTargetName = msg.targetName;
        if (this.role === 'WITCH' && !this.nightActionDone) {
          const area = document.getElementById('night-action-area');
          this._renderWitchPanel(area);
        }
        break;

      case 'HUNTER_SHOOT_PROMPT':
        App.showScreen('voting', { hunterShoot: true, ...msg });
        break;
    }
  }
};
