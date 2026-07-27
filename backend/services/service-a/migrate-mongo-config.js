module.exports = {
  mongodb: {
    url: process.env.MONGO_URI || 'mongodb://localhost:27017',
    databaseName: process.env.MONGO_DB_NAME || 'lumana_service_a',
    options: {},
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  lockCollectionName: 'changelog_lock',
  lockTtl: 0,
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'commonjs',
};
