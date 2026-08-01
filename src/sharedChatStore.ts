export const SHARED_CHAT_STORE = {
  messages: [] as any[],
  notifications: [] as any[],
  load() {
    try {
      const raw = localStorage.getItem('shared_chat_store');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.messages = Array.isArray(parsed.messages) ? parsed.messages : [];
          this.notifications = Array.isArray(parsed.notifications) ? parsed.notifications : [];
        }
      }
    } catch {}
  },
  save() {
    localStorage.setItem('shared_chat_store', JSON.stringify({ messages: this.messages, notifications: this.notifications }));
  },
  pushMessage(msg: any) {
    this.load();
    this.messages.push(msg);
    this.save();
  },
  pushNotification(item: any) {
    this.load();
    this.notifications.push(item);
    this.save();
  }
};

SHARED_CHAT_STORE.load();
