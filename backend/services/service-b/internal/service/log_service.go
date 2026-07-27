package service

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"backend/services/service-b/internal/entity"
	"backend/services/service-b/internal/repository"
	"github.com/redis/go-redis/v9"
)

type LogService interface {
	SaveLog(ctx context.Context, log *entity.Log) error
	GetLogs(ctx context.Context, filter entity.LogFilter) ([]*entity.Log, int64, error)
	StartPubSubSubscriber(ctx context.Context, rdb *redis.Client)
}

type logService struct {
	repo repository.LogRepository
}

func NewLogService(repo repository.LogRepository) LogService {
	return &logService{repo: repo}
}

func (s *logService) SaveLog(ctx context.Context, log *entity.Log) error {
	return s.repo.InsertLog(ctx, log)
}

func (s *logService) GetLogs(ctx context.Context, filter entity.LogFilter) ([]*entity.Log, int64, error) {
	return s.repo.QueryLogs(ctx, filter)
}

func (s *logService) StartPubSubSubscriber(ctx context.Context, rdb *redis.Client) {
	pubsub := rdb.Subscribe(ctx, "service_events")
	ch := pubsub.Channel()

	log.Println("[Go Service B] Subscribed to Redis Pub/Sub channel: service_events")

	go func() {
		defer pubsub.Close()
		for {
			select {
			case <-ctx.Done():
				log.Println("[Go Service B] Stopping Pub/Sub subscriber (graceful shutdown)...")
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}
				var payload map[string]interface{}
				if err := json.Unmarshal([]byte(msg.Payload), &payload); err == nil {
					svc, _ := payload["service"].(string)
					act, _ := payload["action"].(string)
					lvl, _ := payload["level"].(string)
					body, _ := payload["payload"].(string)
					tsFloat, _ := payload["timestamp"].(float64)

					ts := time.Now()
					if tsFloat > 0 {
						ts = time.UnixMilli(int64(tsFloat))
					}

					doc := &entity.Log{
						Service:   svc,
						Action:    act,
						Payload:   body,
						Level:     lvl,
						Timestamp: ts,
					}

					if err := s.repo.InsertLog(ctx, doc); err != nil {
						log.Printf("[Go Service B] Failed to insert log from PubSub: %v\n", err)
					} else {
						log.Printf("[Go Service B] Log stored from PubSub: action=%s, service=%s\n", act, svc)
					}
				}
			}
		}
	}()
}
