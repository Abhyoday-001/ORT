export const AVATARS = [
    'hacker_1', 'hacker_2', 'hacker_3', 'hacker_4',
    'hacker_5', 'hacker_6', 'hacker_7', 'hacker_8',
    'hacker_9', 'hacker_10', 'hacker_11', 'hacker_12'
];

export const getAvatarUrl = (avatarId) => {
    // We can use a public avatar service or local SVGs.
    // For this project, we'll use DiceBear Bottts which fits the cyber theme.
    const seed = avatarId || 'hacker_default';
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=0f172a&colors=00f2ff,00ff9f,ff00e5`;
};
