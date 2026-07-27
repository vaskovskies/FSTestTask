package httpmodel

import (
	"backend/services/service-b/internal/entity"
)

type GetLogsRequest struct {
	Action    string `form:"action"`
	Service   string `form:"service"`
	Level     string `form:"level"`
	StartDate string `form:"start_date"`
	EndDate   string `form:"end_date"`
	Page      int    `form:"page"`
	Limit     int    `form:"limit"`
}

type GetLogsResponse struct {
	Logs  []*LogEntry `json:"logs"`
	Total int64       `json:"total" example:"42"`
	Page  int         `json:"page" example:"1"`
	Limit int         `json:"limit" example:"10"`
}

type LogEntry struct {
	ID        string `json:"id" example:"665f1a2e3a1b2c3d4e5f6a7b"`
	Service   string `json:"service" example:"service-a"`
	Action    string `json:"action" example:"product.search"`
	Payload   string `json:"payload" example:"{\"query\":\"laptop\"}"`
	Level     string `json:"level" example:"info"`
	Timestamp int64  `json:"timestamp" example:"1716300000000"`
}

func ToResponse(logs []*entity.Log, total int64, page, limit int) *GetLogsResponse {
	entries := make([]*LogEntry, len(logs))
	for i, log := range logs {
		entries[i] = &LogEntry{
			ID:        log.ID,
			Service:   log.Service,
			Action:    log.Action,
			Payload:   log.Payload,
			Level:     log.Level,
			Timestamp: log.Timestamp.UnixMilli(),
		}
	}
	return &GetLogsResponse{
		Logs:  entries,
		Total: total,
		Page:  page,
		Limit: limit,
	}
}
