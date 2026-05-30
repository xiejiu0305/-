/**
 * WebSocket 封装：连接管理、消息收发、断线重连
 */
class GameWebSocket {
  constructor() {
    this.ws = null;
    this.url = `ws://${location.host}/ws`;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectBaseDelay = 2000;
    this.handlers = new Map();
    this.pendingQueue = [];
    this.isManualClose = false;
    this.needsReconnect = false;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this._hideReconnectOverlay();

      // 如果之前在一局游戏中，先发重连请求
      if (this.needsReconnect && App.playerId && App.roomCode) {
        this._rawSend(JSON.stringify({
          type: 'RECONNECT',
          playerId: App.playerId,
          roomCode: App.roomCode
        }));
      }

      // 发送排队的消息
      while (this.pendingQueue.length > 0) {
        const msg = this.pendingQueue.shift();
        this._rawSend(msg);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._dispatch(msg.type, msg);
      } catch (e) {
        // 忽略无效消息
      }
    };

    this.ws.onclose = () => {
      if (this.isManualClose) return;
      // 标记需要重连（如果在游戏中）
      if (App.roomCode && App.playerId) {
        this.needsReconnect = true;
      }
      this._attemptReconnect();
    };

    this.ws.onerror = () => {
      // ws.onclose 会紧随其后
    };
  }

  send(type, data = {}) {
    const msg = JSON.stringify({ type, ...data });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this._rawSend(msg);
    } else {
      this.pendingQueue.push(msg);
    }
  }

  _rawSend(msg) {
    try { this.ws.send(msg); } catch (e) { /* ignore */ }
  }

  on(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type).push(handler);
  }

  _dispatch(type, msg) {
    const arr = this.handlers.get(type);
    if (arr) {
      arr.forEach(h => {
        try { h(msg); } catch (e) { /* ignore */ }
      });
    }
  }

  _attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this._showReconnectFailed();
      return;
    }
    this.reconnectAttempts++;
    const delay = this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1);
    this._showReconnectOverlay(this.reconnectAttempts);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  manualReconnect() {
    this.reconnectAttempts = 0;
    this.connect();
  }

  close() {
    this.isManualClose = true;
    this.needsReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  _showReconnectOverlay(attempt) {
    const overlay = document.getElementById('reconnect-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      const text = overlay.querySelector('.reconnect-text');
      if (text) text.textContent = `正在重新连接... (${attempt}/${this.maxReconnectAttempts})`;
    }
  }

  _showReconnectFailed() {
    const overlay = document.getElementById('reconnect-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      const text = overlay.querySelector('.reconnect-text');
      if (text) text.textContent = '连接丢失，请刷新页面重试';
      const btn = document.getElementById('btn-reconnect-retry');
      if (btn) btn.style.display = 'inline-flex';
    }
  }

  _hideReconnectOverlay() {
    const overlay = document.getElementById('reconnect-overlay');
    if (overlay) {
      overlay.style.display = 'none';
      const btn = document.getElementById('btn-reconnect-retry');
      if (btn) btn.style.display = 'none';
    }
  }
}

const ws = new GameWebSocket();
