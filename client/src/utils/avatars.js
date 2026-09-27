/** The avatars a family member can pick on their profile, and the emoji for each. */
export const AVATAR_EMOJIS = {
  default: '😊', cat: '🐱', dog: '🐶', star: '⭐', heart: '❤️',
  flower: '🌸', sun: '☀️', moon: '🌙', crown: '👑', angel: '😇',
};
export const AVATARS = Object.keys(AVATAR_EMOJIS);

export const avatarEmoji = avatar => AVATAR_EMOJIS[avatar] || AVATAR_EMOJIS.default;
