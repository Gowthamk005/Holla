/*
 * Converts database documents into the JSON shapes the React app expects.
 * Never send passwordHash, pinHash or other secrets from here.
 */
export const OWNER_SELECT = "username name avatarUrl bannerUrl bio subscribersCount createdAt";

export const mini = (u) =>
  u ? { id: String(u._id), username: u.username, name: u.name, avatarUrl: u.avatarUrl || "" } : null;

export const pubUser = (u) =>
  u
    ? {
        ...mini(u),
        bannerUrl: u.bannerUrl || "",
        bio: u.bio || "",
        subscribersCount: u.subscribersCount || 0,
        createdAt: u.createdAt,
      }
    : null;

export const selfUser = (u) => ({ ...pubUser(u), role: u.role, interests: u.interests || [] });

export const videoOut = (v) => ({
  id: String(v._id),
  title: v.title,
  description: v.description || "",
  category: v.category,
  videoUrl: v.videoUrl,
  thumbnailUrl: v.thumbnailUrl || "",
  duration: v.duration || 0,
  views: v.views || 0,
  likesCount: v.likesCount || 0,
  createdAt: v.createdAt,
  renditions: (v.renditions || []).map((r) => ({ label: r.label, height: r.height, url: r.url })),  
  owner: pubUser(v.owner),
});

export const msgOut = (m) => {
  const deleted = !!m.deletedAt;
  const att = !deleted && m.attachment && m.attachment.url
    ? { type: m.attachment.type, url: m.attachment.url, name: m.attachment.name, size: m.attachment.size, mime: m.attachment.mime }
    : null;
  return {
    id: String(m._id),
    from: String(m.from),
    to: String(m.to),
    text: deleted ? "" : m.text || "",
    attachment: att,
    createdAt: m.createdAt,
    readAt: m.readAt || null,
    editedAt: m.editedAt || null,
    deletedAt: m.deletedAt || null,
  };
};

export const txOut = (t) => ({
  id: String(t._id),
  txId: t.txId,
  from: mini(t.from),
  to: mini(t.to),
  amount: t.amount,
  kind: t.kind,
  note: t.note || "",
  createdAt: t.createdAt,
});

export const reqOut = (r) => ({
  id: String(r._id),
  from: mini(r.from),
  to: mini(r.to),
  amount: r.amount,
  note: r.note || "",
  status: r.status,
  createdAt: r.createdAt,
});
