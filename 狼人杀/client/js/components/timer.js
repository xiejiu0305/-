/**
 * 计时器组件：顶部进度条 + 时间数字
 */
const Timer = {
  bar: null,
  totalSeconds: 0,
  currentSeconds: 0,

  init() {
    this.bar = document.getElementById('timer-bar');
  },

  start(totalSeconds) {
    this.totalSeconds = totalSeconds;
    this.currentSeconds = totalSeconds;
    this.bar.style.width = '100%';
    this.bar.classList.remove('warning', 'danger');
  },

  tick(secondsRemaining) {
    this.currentSeconds = secondsRemaining;
    const pct = (secondsRemaining / this.totalSeconds) * 100;
    this.bar.style.width = pct + '%';

    if (pct <= 25) {
      this.bar.classList.add('danger');
      this.bar.classList.remove('warning');
    } else if (pct <= 50) {
      this.bar.classList.add('warning');
      this.bar.classList.remove('danger');
    } else {
      this.bar.classList.remove('warning', 'danger');
    }
  },

  reset() {
    this.bar.style.width = '0%';
    this.bar.classList.remove('warning', 'danger');
  }
};
