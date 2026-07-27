package repository

import (
	"context"

	"backend/services/service-b/internal/entity"
	"backend/services/service-b/internal/entity/mongomodel"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type LogRepository interface {
	InsertLog(ctx context.Context, doc *entity.Log) error
	QueryLogs(ctx context.Context, filter entity.LogFilter) ([]*entity.Log, int64, error)
}

type mongoLogRepository struct {
	collection *mongo.Collection
}

func NewLogRepository(db *mongo.Database) LogRepository {
	return &mongoLogRepository{
		collection: db.Collection("logs"),
	}
}

func (r *mongoLogRepository) InsertLog(ctx context.Context, log *entity.Log) error {
	doc := mongomodel.FromDomain(log)
	_, err := r.collection.InsertOne(ctx, doc)
	return err
}

func (r *mongoLogRepository) QueryLogs(ctx context.Context, filter entity.LogFilter) ([]*entity.Log, int64, error) {
	bsonFilter := bson.M{}

	if filter.Service != "" {
		bsonFilter["service"] = filter.Service
	}
	if filter.Action != "" {
		bsonFilter["action"] = filter.Action
	}
	if filter.Level != "" {
		bsonFilter["level"] = filter.Level
	}

	if filter.StartDate != nil || filter.EndDate != nil {
		dateFilter := bson.M{}
		if filter.StartDate != nil {
			dateFilter["$gte"] = *filter.StartDate
		}
		if filter.EndDate != nil {
			dateFilter["$lte"] = *filter.EndDate
		}
		bsonFilter["timestamp"] = dateFilter
	}

	total, err := r.collection.CountDocuments(ctx, bsonFilter)
	if err != nil {
		return nil, 0, err
	}

	page := filter.Page
	if page < 1 {
		page = 1
	}
	limit := filter.Limit
	if limit < 1 {
		limit = 10
	}
	skip := int64((page - 1) * limit)

	findOpts := options.Find().
		SetSort(bson.D{{Key: "timestamp", Value: -1}}).
		SetSkip(skip).
		SetLimit(int64(limit))

	cursor, err := r.collection.Find(ctx, bsonFilter, findOpts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var docs []*mongomodel.LogDocument
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, 0, err
	}

	logs := make([]*entity.Log, len(docs))
	for i, doc := range docs {
		logs[i] = mongomodel.ToDomain(doc)
	}

	return logs, total, nil
}
