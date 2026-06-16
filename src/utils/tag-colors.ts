const TAG_GROUPS: Record<string, readonly string[]> = {
  tech: ['shader', 'hlsl', 'urp', 'vfx'],
  tools: ['tool', 'editor', 'asset'],
  games: ['game', 'jam'],
  status: ['wip', 'study'],
  personal: ['dnd', 'worldbuilding', 'design'],
};

const TAG_TO_GROUP = new Map<string, string>(
  Object.entries(TAG_GROUPS).flatMap(([group, tags]) => tags.map((tag) => [tag, group] as const)),
);

export function getTagGroup(tag: string): string | null {
  return TAG_TO_GROUP.get(tag.toLowerCase()) ?? null;
}

export function getTagColorClass(tag: string): string {
  const group = getTagGroup(tag);
  return group ? `tag-color-${group}` : '';
}
