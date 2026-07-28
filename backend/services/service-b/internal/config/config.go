package config

import (
	"log"
	"net/url"
	"strings"

	"github.com/spf13/viper"
)

func RedactMongoURI(rawURI string) string {
	u, err := url.Parse(rawURI)
	if err != nil || u.User == nil {
		return "invalid_uri"
	}
	u.User = url.UserPassword(u.User.Username(), "*****")
	return u.String()
}

type Config struct {
	Port           string `mapstructure:"PORT"`
	GRPCPort       string `mapstructure:"GRPC_PORT"`
	MongoURI       string `mapstructure:"MONGO_URI"`
	MongoDBName    string `mapstructure:"MONGO_DB_NAME"`
	RedisHost      string `mapstructure:"REDIS_HOST"`
	RedisPort      string `mapstructure:"REDIS_PORT"`
	MigrationsPath string `mapstructure:"MIGRATIONS_PATH"`
}

var Cfg *Config

func InitConfig() *Config {
	v := viper.New()

	v.SetDefault("PORT", "8080")
	v.SetDefault("GRPC_PORT", "50052")
	v.SetDefault("MONGO_URI", "mongodb://root:examplesecret@localhost:27017/lumana_db?authSource=admin")
	v.SetDefault("MONGO_DB_NAME", "lumana_db")
	v.SetDefault("REDIS_HOST", "localhost")
	v.SetDefault("REDIS_PORT", "6379")
	v.SetDefault("MIGRATIONS_PATH", "migrations")

	v.AutomaticEnv()
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// Optionally load from .env file if available
	v.SetConfigFile(".env")
	v.SetConfigType("env")
	if err := v.ReadInConfig(); err == nil {
		log.Println("[Config] Loaded configuration from .env file")
	}

	var c Config
	if err := v.Unmarshal(&c); err != nil {
		log.Fatalf("[Config] Unable to decode configuration into struct: %v", err)
	}

	Cfg = &c
	log.Printf("[Config] Service B Configuration initialized (Port: %s, GRPCPort: %s, MongoURI: %s)\n", Cfg.Port, Cfg.GRPCPort, RedactMongoURI(Cfg.MongoURI))
	return Cfg
}
