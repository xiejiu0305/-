/**
 * 聊天组件：消息列表 + 输入
 */
const Chat = {
  /**
   * 渲染聊天消息到指定容器
   * @param {HTMLElement} container - 消息列表容器
   * @param {Array} messages - [{playerId, playerName, text, isSystem}]
   * @param {string} myPlayerId - 当前玩家 ID（用于样式对齐）
   */
  renderMessages(container, messages, myPlayerId) {
    container.innerHTML = '';
    messages.forEach(msg => {
      const div = document.createElement('div');
      div.className = 'chat-msg';
      if (msg.isSystem || msg.playerId === 'system') {
        div.classList.add('system');
        div.textContent = msg.text;
      } else if (msg.playerId === myPlayerId) {
        div.classList.add('me');
        div.textContent = msg.text;
      } else {
        div.classList.add('other');
        const nameEl = document.createElement('span');
        nameEl.style.cssText = 'font-weight:700;color:' + PlayerList.getColor(msg.playerName) + ';display:block;font-size:12px;margin-bottom:2px;';
        nameEl.textContent = msg.playerName;
        div.appendChild(nameEl);
        div.appendChild(document.createTextNode(msg.text));
      }
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  },

  /**
   * 追加单条消息
   */
  appendMessage(container, msg, myPlayerId) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    if (msg.isSystem || msg.playerId === 'system') {
      div.classList.add('system');
      div.textContent = msg.text;
    } else if (msg.playerId === myPlayerId) {
      div.classList.add('me');
      div.textContent = msg.text;
    } else {
      div.classList.add('other');
      const nameEl = document.createElement('span');
      nameEl.style.cssText = 'font-weight:700;color:' + PlayerList.getColor(msg.playerName) + ';display:block;font-size:12px;margin-bottom:2px;';
      nameEl.textContent = msg.playerName;
      div.appendChild(nameEl);
      div.appendChild(document.createTextNode(msg.text));
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }
};
