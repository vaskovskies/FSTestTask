package pb

import (
	"context"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type LogEventRequest struct {
	Service   string `json:"service"`
	Action    string `json:"action"`
	Payload   string `json:"payload"`
	Level     string `json:"level"`
	Timestamp int64  `json:"timestamp"`
}

type LogEventResponse struct {
	Success bool   `json:"success"`
	LogId   string `json:"log_id"`
}

type GetLogsRequest struct {
	Action    string `json:"action"`
	Service   string `json:"service"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
	Page      int32  `json:"page"`
	Limit     int32  `json:"limit"`
}

type LogEntry struct {
	Id        string `json:"id"`
	Service   string `json:"service"`
	Action    string `json:"action"`
	Payload   string `json:"payload"`
	Level     string `json:"level"`
	Timestamp int64  `json:"timestamp"`
}

type GetLogsResponse struct {
	Logs  []*LogEntry `json:"logs"`
	Total int64       `json:"total"`
	Page  int32       `json:"page"`
	Limit int32       `json:"limit"`
}

type GenerateReportRequest struct {
	MetricName     string `json:"metric_name"`
	StartTimestamp int64  `json:"start_timestamp"`
	EndTimestamp   int64  `json:"end_timestamp"`
}

type GenerateReportResponse struct {
	PdfContent []byte `json:"pdf_content"`
	Filename   string `json:"filename"`
}

type LogServiceServer interface {
	LogEvent(context.Context, *LogEventRequest) (*LogEventResponse, error)
	GetLogs(context.Context, *GetLogsRequest) (*GetLogsResponse, error)
	GenerateReport(context.Context, *GenerateReportRequest) (*GenerateReportResponse, error)
}

type UnimplementedLogServiceServer struct{}

func (UnimplementedLogServiceServer) LogEvent(context.Context, *LogEventRequest) (*LogEventResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method LogEvent not implemented")
}
func (UnimplementedLogServiceServer) GetLogs(context.Context, *GetLogsRequest) (*GetLogsResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetLogs not implemented")
}
func (UnimplementedLogServiceServer) GenerateReport(context.Context, *GenerateReportRequest) (*GenerateReportResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GenerateReport not implemented")
}

func RegisterLogServiceServer(s *grpc.Server, srv LogServiceServer) {
	s.RegisterService(&_LogService_serviceDesc, srv)
}

var _LogService_serviceDesc = grpc.ServiceDesc{
	ServiceName: "logs.LogService",
	HandlerType: (*LogServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "LogEvent",
			Handler:    nil,
		},
		{
			MethodName: "GetLogs",
			Handler:    nil,
		},
		{
			MethodName: "GenerateReport",
			Handler:    nil,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "logs.proto",
}
