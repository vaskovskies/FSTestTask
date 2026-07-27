module.exports = {
  async up(db) {
    await db.collection('products').createIndex(
      { title: 'text', description: 'text', category: 'text', brand: 'text' },
      {
        name: 'products_text_search_idx',
        weights: { title: 10, brand: 5, category: 3, description: 1 },
        background: true,
      },
    );
  },

  async down(db) {
    await db.collection('products').dropIndex('products_text_search_idx');
  },
};
