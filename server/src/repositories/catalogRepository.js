const config = require('../config');
const { getMongoDb } = require('../config/mongodb');

let indexesReady = false;

function isIndexable(bounty) {
  return bounty
    && bounty.status === 'OPEN'
    && (!bounty.deadline || new Date(bounty.deadline) > new Date());
}

function toCatalogDocument(bounty) {
  const createdAt = bounty.createdAt ? new Date(bounty.createdAt) : new Date();
  const updatedAt = bounty.updatedAt ? new Date(bounty.updatedAt) : createdAt;
  const deadline = bounty.deadline ? new Date(bounty.deadline) : null;

  return {
    _id: bounty.id,
    id: bounty.id,
    title: bounty.title,
    description: bounty.description,
    rewardPoints: bounty.rewardPoints,
    category: bounty.category,
    department: bounty.department || null,
    skills: Array.isArray(bounty.skills) ? bounty.skills : [],
    status: bounty.status,
    deadline,
    createdAt,
    updatedAt,
    creator: bounty.creator
      ? {
          id: bounty.creator.id,
          name: bounty.creator.name,
          avatarUrl: bounty.creator.avatarUrl || null,
          reputation: bounty.creator.reputation,
          university: bounty.creator.university
            ? {
                name: bounty.creator.university.name,
                country: bounty.creator.university.country,
              }
            : null,
        }
      : null,
    _count: bounty._count || { bids: 0, submissions: 0, comments: 0 },
    searchableText: [
      bounty.title,
      bounty.description,
      bounty.category,
      bounty.department,
      ...(Array.isArray(bounty.skills) ? bounty.skills : []),
      bounty.creator?.university?.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    indexedAt: new Date(),
  };
}

async function collection() {
  const db = await getMongoDb();
  if (!db) return null;

  const col = db.collection(config.mongo.catalogCollection);
  if (!indexesReady) {
    await Promise.all([
      col.createIndex({ status: 1, createdAt: -1 }),
      col.createIndex({ category: 1, status: 1 }),
      col.createIndex({ 'creator.university.name': 1 }),
      col.createIndex({ searchableText: 'text' }),
    ]);
    indexesReady = true;
  }
  return col;
}

const catalogRepository = {
  async upsertBounty(bounty) {
    const col = await collection();
    if (!col) return false;

    if (!isIndexable(bounty)) {
      await col.deleteOne({ _id: bounty.id });
      return true;
    }

    await col.updateOne(
      { _id: bounty.id },
      { $set: toCatalogDocument(bounty) },
      { upsert: true }
    );
    return true;
  },

  async removeBounty(bountyId) {
    const col = await collection();
    if (!col) return false;
    await col.deleteOne({ _id: bountyId });
    return true;
  },

  async rebuild(bounties) {
    const col = await collection();
    if (!col) return { enabled: false, count: 0 };

    await col.deleteMany({});
    const docs = bounties.filter(isIndexable).map(toCatalogDocument);
    if (docs.length) {
      await col.bulkWrite(
        docs.map((doc) => ({
          updateOne: {
            filter: { _id: doc.id },
            update: { $set: doc },
            upsert: true,
          },
        }))
      );
    }
    return { enabled: true, count: docs.length };
  },

  async findByIds(ids) {
    const col = await collection();
    if (!col || !ids.length) return null;

    const docs = await col.find({ _id: { $in: ids } }).toArray();
    const byId = new Map(docs.map(({ _id, ...doc }) => [doc.id, doc]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  },
};

module.exports = catalogRepository;
