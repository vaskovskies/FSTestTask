module.exports = {
  async up(db) {
    await db.collection('products').createIndex({ price: 1 }, { background: true });
    await db.collection('products').createIndex({ category: 1 }, { background: true });
  },

  async down(db) {
    await db.collection('products').dropIndex('price_1');
    await db.collection('products').dropIndex('category_1');
  },
};
