package handler

import (
	"context"
	"time"

	"backend/services/service-b/internal/entity"
	"backend/services/service-b/internal/service"
	"backend/services/service-b/pkg/pb"
)

type GRPCHandler struct {
	pb.UnimplementedLogServiceServer
	logService    service.LogService
	reportService service.ReportService
}

func NewGRPCHandler(logService service.LogService, reportService service.ReportService) *GRPCHandler {
	return &GRPCHandler{
		logService:    logService,
		reportService: reportService,
	}
}

func (g *GRPCHandler) LogEvent(ctx context.Context, req *pb.LogEventRequest) (*pb.LogEventResponse, error) {
	ts := time.Now()
	if req.Timestamp > 0 {
		ts = time.UnixMilli(req.Timestamp)
	}

	doc := &entity.Log{
		Service:   req.Service,
		Action:    req.Action,
		Payload:   req.Payload,
		Level:     req.Level,
		Timestamp: ts,
	}

	if err := g.logService.SaveLog(ctx, doc); err != nil {
		return &pb.LogEventResponse{Success: false}, err
	}

	return &pb.LogEventResponse{Success: true, LogId: doc.ID}, nil
}

func (g *GRPCHandler) GetLogs(ctx context.Context, req *pb.GetLogsRequest) (*pb.GetLogsResponse, error) {
	filter := entity.LogFilter{
		Service: req.Service,
		Action:  req.Action,
		Page:    int(req.Page),
		Limit:   int(req.Limit),
	}

	logs, total, err := g.logService.GetLogs(ctx, filter)
	if err != nil {
		return nil, err
	}

	var pbLogs []*pb.LogEntry
	for _, l := range logs {
		pbLogs = append(pbLogs, &pb.LogEntry{
			Id:        l.ID,
			Service:   l.Service,
			Action:    l.Action,
			Payload:   l.Payload,
			Level:     l.Level,
			Timestamp: l.Timestamp.UnixMilli(),
		})
	}

	return &pb.GetLogsResponse{
		Logs:  pbLogs,
		Total: total,
		Page:  req.Page,
		Limit: req.Limit,
	}, nil
}

func (g *GRPCHandler) GenerateReport(ctx context.Context, req *pb.GenerateReportRequest) (*pb.GenerateReportResponse, error) {
	pdfBytes, filename, err := g.reportService.GenerateTimeSeriesPDFReport(ctx, req.StartTimestamp, req.EndTimestamp)
	if err != nil {
		return nil, err
	}

	return &pb.GenerateReportResponse{
		PdfContent: pdfBytes,
		Filename:   filename,
	}, nil
}
