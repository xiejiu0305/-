/**
 * Home 屏幕：输入昵称、创建/加入房间
 */
const HomeScreen = {
  setup() {
    const nameInput = document.getElementById('home-name');
    const codeInput = document.getElementById('home-room-code');
    const errorEl = document.getElementById('home-error');

    const saved = localStorage.getItem('werewolf_name');
    if (saved) nameInput.value = saved;

    const showError = (msg) => { errorEl.textContent = msg; };
    const clearError = () => { errorEl.textContent = ''; };

    const validateName = () => {
      const name = nameInput.value.trim();
      if (!name || name.length < 2) { showError('昵称至少 2 个字符'); return null; }
      if (name.length > 12) { showError('昵称最多 12 个字符'); return null; }
      return name;
    };

    document.getElementById('btn-create').onclick = () => {
      clearError();
      const name = validateName();
      if (!name) return;
      localStorage.setItem('werewolf_name', name);
      App.playerName = name;
      ws.send('CREATE_ROOM', { playerName: name });
    };

    document.getElementById('btn-join').onclick = () => {
      clearError();
      const name = validateName();
      if (!name) return;
      const code = codeInput.value.toUpperCase().trim();
      if (code.length !== 4) { showError('房间码为 4 位字符'); return; }
      localStorage.setItem('werewolf_name', name);
      App.playerName = name;
      App.roomCode = code;
      ws.send('JOIN_ROOM', { roomCode: code, playerName: name });
    };

    // Enter 快捷操作
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-join').click();
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-create').click();
    });

    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
  },

  handleMessage(msg) {
    if (msg.type === 'ERROR') {
      document.getElementById('home-error').textContent = msg.message;
    }
  }
};
