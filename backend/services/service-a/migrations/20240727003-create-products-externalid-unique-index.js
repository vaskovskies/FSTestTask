module.exports = {
  async up(db) {
    await db.collection('products').createIndex(
      { externalId: 1 },
      { unique: true, sparse: true, background: true },
    );
  },

  async down(db) {
    await db.collection('products').dropIndex('externalId_1');
  },
};
