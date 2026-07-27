package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend/services/service-b/internal/config"
	"backend/services/service-b/internal/handler"
	"backend/services/service-b/internal/repository"
	"backend/services/service-b/internal/service"
	"backend/services/service-b/pkg/pb"

	_ "backend/services/service-b/docs"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/mongodb"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"google.golang.org/grpc"
)

// @title           Service B - Log Aggregation API
// @version         1.0
// @description     Go microservice for log aggregation, querying, and PDF report generation.
// @host            localhost:8080
// @BasePath        /api
// @schemes         http
func main() {
	log.Println("[Go Service B] Starting service initialization...")

	// 1. Initialize Configuration using Viper / config package
	cfg := config.InitConfig()

	// Root context listening for termination OS signals for graceful shutdown
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// 2. Database Connections
	log.Printf("[Go Service B] Connecting to MongoDB at %s...\n", cfg.MongoURI)
	mongoClient, err := mongo.Connect(ctx, options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		log.Fatalf("MongoDB connection failed: %v", err)
	}
	defer func() {
		log.Println("[Go Service B] Closing MongoDB connection...")
		_ = mongoClient.Disconnect(context.Background())
	}()

	db := mongoClient.Database(cfg.MongoDBName)

	// 3. Execute Database Migrations
	log.Println("[Go Service B] Checking database migrations...")
	m, err := migrate.New(
		"file://"+cfg.MigrationsPath,
		cfg.MongoURI,
	)
	if err != nil {
		log.Printf("[Go Service B] Migration init warning: %v\n", err)
	} else {
		defer m.Close()
		if err := m.Up(); err != nil && err != migrate.ErrNoChange {
			log.Printf("[Go Service B] Database migration warning: %v\n", err)
		} else {
			log.Println("[Go Service B] Migrations applied successfully!")
		}
	}

	// 4. Redis Connection
	rdb := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort),
	})
	defer func() {
		log.Println("[Go Service B] Closing Redis connection...")
		_ = rdb.Close()
	}()

	// 5. Initialize Repository, Services, and Handlers
	logRepo := repository.NewLogRepository(db)
	logService := service.NewLogService(logRepo)
	reportService := service.NewReportService(rdb)

	// 6. Start Background Pub/Sub Subscriber
	logService.StartPubSubSubscriber(ctx, rdb)

	// 7. Setup HTTP REST Server (Gin)
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()
	httpHandler := handler.NewHTTPHandler(logService, reportService)
	httpHandler.RegisterRoutes(router)

	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	httpServer := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	go func() {
		log.Printf("[Go Service B] REST API server listening on http://localhost:%s\n", cfg.Port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// 8. Setup gRPC Server
	grpcListener, err := net.Listen("tcp", ":"+cfg.GRPCPort)
	if err != nil {
		log.Fatalf("Failed to listen for gRPC on port %s: %v", cfg.GRPCPort, err)
	}

	grpcServer := grpc.NewServer()
	grpcHandler := handler.NewGRPCHandler(logService, reportService)
	pb.RegisterLogServiceServer(grpcServer, grpcHandler)

	go func() {
		log.Printf("[Go Service B] gRPC server listening on port %s\n", cfg.GRPCPort)
		if err := grpcServer.Serve(grpcListener); err != nil {
			log.Fatalf("gRPC server error: %v", err)
		}
	}()

	// 9. Wait for termination signal (Graceful Shutdown)
	<-ctx.Done()
	log.Println("[Go Service B] Termination signal received! Initiating graceful shutdown...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("[Go Service B] HTTP server shutdown error: %v\n", err)
	}

	grpcServer.GracefulStop()
	log.Println("[Go Service B] Service B successfully shut down.")
}
