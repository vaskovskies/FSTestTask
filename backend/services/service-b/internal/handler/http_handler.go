package handler

import (
	"net/http"
	"strconv"
	"time"

	"backend/services/service-b/internal/entity"
	"backend/services/service-b/internal/entity/httpmodel"
	"backend/services/service-b/internal/service"
	"github.com/gin-gonic/gin"
)

type HTTPHandler struct {
	logService    service.LogService
	reportService service.ReportService
}

func NewHTTPHandler(logService service.LogService, reportService service.ReportService) *HTTPHandler {
	return &HTTPHandler{
		logService:    logService,
		reportService: reportService,
	}
}

func (h *HTTPHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		api.GET("/logs", h.GetLogs)
		api.GET("/reports/pdf", h.GeneratePDFReport)
		api.GET("/health", h.HealthCheck)
	}
}

// HealthCheck godoc
// @Summary      Health check
// @Description  Returns the health status of the service
// @Tags         health
// @Produce      json
// @Success      200  {object}  map[string]string
// @Router       /health [get]
func (h *HTTPHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "Service-B (Go)"})
}

// GetLogs godoc
// @Summary      Query logs
// @Description  Retrieve logs with optional filtering by service, action, level, and date range, with pagination
// @Tags         logs
// @Accept       json
// @Produce      json
// @Param        action     query  string  false  "Filter by action name"
// @Param        service    query  string  false  "Filter by service name"
// @Param        level      query  string  false  "Filter by log level"  Enums(debug, info, warn, error)
// @Param        start_date query  string  false  "Start date in RFC3339 format"  example(2024-01-01T00:00:00Z)
// @Param        end_date   query  string  false  "End date in RFC3339 format"  example(2024-12-31T23:59:59Z)
// @Param        page       query  int     false  "Page number"  default(1)
// @Param        limit      query  int     false  "Items per page"  default(10)
// @Success      200  {object}  httpmodel.GetLogsResponse
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /logs [get]
func (h *HTTPHandler) GetLogs(c *gin.Context) {
	var req httpmodel.GetLogsRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var startDate, endDate *time.Time
	if req.StartDate != "" {
		if t, err := time.Parse(time.RFC3339, req.StartDate); err == nil {
			startDate = &t
		}
	}
	if req.EndDate != "" {
		if t, err := time.Parse(time.RFC3339, req.EndDate); err == nil {
			endDate = &t
		}
	}

	filter := entity.LogFilter{
		Service:   req.Service,
		Action:    req.Action,
		Level:     req.Level,
		StartDate: startDate,
		EndDate:   endDate,
		Page:      req.Page,
		Limit:     req.Limit,
	}

	logs, total, err := h.logService.GetLogs(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := httpmodel.ToResponse(logs, total, filter.Page, filter.Limit)
	c.JSON(http.StatusOK, response)
}

// GeneratePDFReport godoc
// @Summary      Generate PDF report
// @Description  Generate a PDF report from Redis TimeSeries data for a given metric and time range
// @Tags         reports
// @Produce      application/pdf
// @Param        metric  query  string  false  "Redis TimeSeries metric key"  default(ts:search_queries)
// @Param        start   query  int64   false  "Start timestamp in milliseconds (defaults to 24h ago)"
// @Param        end     query  int64   false  "End timestamp in milliseconds (defaults to now)"
// @Success      200  {file}    binary
// @Failure      500  {object}  map[string]string
// @Router       /reports/pdf [get]
func (h *HTTPHandler) GeneratePDFReport(c *gin.Context) {
	metric := c.DefaultQuery("metric", "ts:search_queries")
	startTs, _ := strconv.ParseInt(c.Query("start"), 10, 64)
	endTs, _ := strconv.ParseInt(c.Query("end"), 10, 64)

	pdfBytes, filename, err := h.reportService.GenerateTimeSeriesPDFReport(c.Request.Context(), metric, startTs, endTs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}
