export function messageStatus(msg, conv, meId) {
  if (msg.pending) return 'pending';
  if (msg.failed) return 'failed';
  const others = (conv?.members || []).filter((m) => m.id !== meId);
  if (!others.length) return 'sent';
  const t = new Date(msg.createdAt);
  if (others.every((m) => m.lastReadAt && new Date(m.lastReadAt) >= t)) return 'read';
  if (others.every((m) => m.lastDeliveredAt && new Date(m.lastDeliveredAt) >= t)) return 'delivered';
  return 'sent';
}

export const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

export const EMOJIS = [
  '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😋','😎','🤩','🥳','😏',
  '😌','😴','🤔','🤗','🤭','🤫','😐','🙄','😬','😮','😯','😲','🥺','😢','😭','😤','😠','😡','🤯','😳',
  '😱','😓','🤝','👍','👎','👏','🙌','🙏','💪','👋','✌️','🤞','👌','🤌','👀','💯','🔥','✨','⭐','🌟',
  '❤️','🧡','💛','💚','💙','💜','🤍','🖤','💔','💕','🎉','🎊','🎁','🎂','🍾','🥂','☕','🍕','🍔','⚽',
  '🏆','🎵','🎶','📚','✍️','💼','💻','📱','📷','🎬','✈️','🚗','🏠','🌍','🌙','☀️','🌧️','🌹','🌻','🙈',
];

export function displayName(user, meId) {
  if (!user) return 'Someone';
  return user.id === meId ? 'You' : user.name;
}
