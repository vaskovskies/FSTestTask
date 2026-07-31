package service

import (
	"context"
	"log"
	"strconv"
	"strings"
	"time"

	"backend/services/service-b/internal/entity"
	"backend/services/service-b/internal/repository"
	"github.com/redis/go-redis/v9"
)

type LogService interface {
	SaveLog(ctx context.Context, log *entity.Log) error
	GetLogs(ctx context.Context, filter entity.LogFilter) ([]*entity.Log, int64, error)
	StartStreamConsumer(ctx context.Context, rdb *redis.Client)
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

const (
	eventStream      = "service_events"
	consumerGroup    = "service-b-go-group"
	consumerName     = "service-b-go-1"
	streamReadCount  = 10
	streamReadBlock  = 5 * time.Second
	streamMaxEntries = 100000
)

func (s *logService) StartStreamConsumer(ctx context.Context, rdb *redis.Client) {
	createStreamGroup(ctx, rdb)

	log.Printf("[Go Service B] Started stream consumer: stream=%s group=%s consumer=%s\n", eventStream, consumerGroup, consumerName)

	go func() {
		for {
			if err := ctx.Err(); err != nil {
				log.Println("[Go Service B] Stopping stream consumer (graceful shutdown)...")
				return
			}

			streams, err := rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
				Group:    consumerGroup,
				Consumer: consumerName,
				Streams:  []string{eventStream, ">"},
				Count:    streamReadCount,
				Block:    streamReadBlock,
			}).Result()
			if err != nil {
				if err == redis.Nil || ctx.Err() != nil {
					continue
				}
				log.Printf("[Go Service B] Stream read error: %v\n", err)
				time.Sleep(time.Second)
				continue
			}

			for _, stream := range streams {
				for _, msg := range stream.Messages {
					if err := s.processStreamMessage(ctx, rdb, msg); err != nil {
						log.Printf("[Go Service B] Failed to process stream message %s: %v\n", msg.ID, err)
						continue
					}
				}
			}
		}
	}()
}

func createStreamGroup(ctx context.Context, rdb *redis.Client) {
	err := rdb.XGroupCreateMkStream(ctx, eventStream, consumerGroup, "0").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		log.Printf("[Go Service B] Failed to create stream group %s: %v\n", consumerGroup, err)
	}
}

func (s *logService) processStreamMessage(ctx context.Context, rdb *redis.Client, msg redis.XMessage) error {
	doc, err := streamMessageToLog(msg)
	if err != nil {
		return err
	}

	if err := s.repo.InsertLog(ctx, doc); err != nil {
		return err
	}

	if err := rdb.XAck(ctx, eventStream, consumerGroup, msg.ID).Err(); err != nil {
		log.Printf("[Go Service B] Failed to ack stream message %s: %v\n", msg.ID, err)
	}

	log.Printf("[Go Service B] Log stored from stream: action=%s, service=%s\n", doc.Action, doc.Service)
	return nil
}

func streamMessageToLog(msg redis.XMessage) (*entity.Log, error) {
	payload, ok := msg.Values["payload"].(string)
	if !ok {
		payload = ""
	}

	ts := time.Now()
	if raw, ok := msg.Values["timestamp"].(string); ok {
		if tsMillis, err := strconv.ParseInt(raw, 10, 64); err == nil && tsMillis > 0 {
			ts = time.UnixMilli(tsMillis)
		}
	}

	return &entity.Log{
		Service:   asString(msg.Values["service"]),
		Action:    asString(msg.Values["action"]),
		Payload:   payload,
		Level:     asString(msg.Values["level"]),
		Timestamp: ts,
	}, nil
}

func asString(v interface{}) string {
	s, _ := v.(string)
	return s
}
