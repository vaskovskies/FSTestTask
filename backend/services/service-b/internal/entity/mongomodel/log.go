package mongomodel

import (
	"time"

	"backend/services/service-b/internal/entity"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type LogDocument struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Service   string             `bson:"service" json:"service"`
	Action    string             `bson:"action" json:"action"`
	Payload   string             `bson:"payload" json:"payload"`
	Level     string             `bson:"level" json:"level"`
	Timestamp time.Time          `bson:"timestamp" json:"timestamp"`
}

func ToDomain(doc *LogDocument) *entity.Log {
	return &entity.Log{
		ID:        doc.ID.Hex(),
		Service:   doc.Service,
		Action:    doc.Action,
		Payload:   doc.Payload,
		Level:     doc.Level,
		Timestamp: doc.Timestamp,
	}
}

func FromDomain(log *entity.Log) *LogDocument {
	id, _ := primitive.ObjectIDFromHex(log.ID)
	return &LogDocument{
		ID:        id,
		Service:   log.Service,
		Action:    log.Action,
		Payload:   log.Payload,
		Level:     log.Level,
		Timestamp: log.Timestamp,
	}
}
