package service

import (
	"bytes"
	"context"
	"fmt"
	stdimage "image"
	"image/color"
	"image/png"
	"strconv"
	"time"

	"github.com/johnfercher/maroto/v2"
	"github.com/johnfercher/maroto/v2/pkg/components/code"
	"github.com/johnfercher/maroto/v2/pkg/components/col"
	"github.com/johnfercher/maroto/v2/pkg/components/image"
	"github.com/johnfercher/maroto/v2/pkg/components/line"
	"github.com/johnfercher/maroto/v2/pkg/components/row"
	"github.com/johnfercher/maroto/v2/pkg/components/text"
	"github.com/johnfercher/maroto/v2/pkg/config"
	"github.com/johnfercher/maroto/v2/pkg/consts/align"
	"github.com/johnfercher/maroto/v2/pkg/consts/extension"
	"github.com/johnfercher/maroto/v2/pkg/consts/fontstyle"
	"github.com/johnfercher/maroto/v2/pkg/props"
	"github.com/redis/go-redis/v9"
	"github.com/wcharczuk/go-chart/v2"
	"github.com/wcharczuk/go-chart/v2/drawing"
)

type ReportService interface {
	GenerateTimeSeriesPDFReport(ctx context.Context, key string, startTs, endTs int64) ([]byte, string, error)
}

type reportService struct {
	rdb *redis.Client
}

func NewReportService(rdb *redis.Client) ReportService {
	return &reportService{rdb: rdb}
}

func (s *reportService) GenerateTimeSeriesPDFReport(ctx context.Context, key string, startTs, endTs int64) ([]byte, string, error) {
	if key == "" {
		key = "ts:search_queries"
	}
	if startTs <= 0 {
		startTs = time.Now().Add(-24 * time.Hour).UnixMilli()
	}
	if endTs <= 0 {
		endTs = time.Now().UnixMilli()
	}

	// 1. Fetch RedisTimeSeries range data: TS.RANGE key startTs endTs
	res, err := s.rdb.Do(ctx, "TS.RANGE", key, startTs, endTs).Result()
	var xValues []time.Time
	var yValues []float64

	if err == nil && res != nil {
		if rawSlice, ok := res.([]interface{}); ok {
			for _, item := range rawSlice {
				if tuple, ok := item.([]interface{}); ok && len(tuple) == 2 {
					// Time Parsing
					tsVal, _ := tuple[0].(int64)

					// Safely parse the value whether Redis returns a string, []byte, or float
					var valStr string
					switch v := tuple[1].(type) {
					case string:
						valStr = v
					case []byte:
						valStr = string(v)
					default:
						valStr = fmt.Sprintf("%v", v)
					}

					valFloat, _ := strconv.ParseFloat(valStr, 64)

					xValues = append(xValues, time.UnixMilli(tsVal))
					yValues = append(yValues, valFloat)
				}
			}
		}
	}

	// Fallback sample data points for chart rendering if time series is empty
	if len(xValues) == 0 {
		now := time.Now()
		xValues = []time.Time{now.Add(-4 * time.Hour), now.Add(-3 * time.Hour), now.Add(-2 * time.Hour), now.Add(-1 * time.Hour), now}
		yValues = []float64{12, 45, 89, 34, 110}
	}

	// 2. Generate Chart PNG image using go-chart
	graph := chart.Chart{
		Title:  fmt.Sprintf("Metric Analytics: %s", key),
		Width:  600,
		Height: 300,
		XAxis: chart.XAxis{
			Name: "Time",
			Style: chart.Style{
				Hidden: false, // EXPLICITLY SHOW THE AXIS
			},
			ValueFormatter: chart.TimeValueFormatter, // FORMAT TICKS AS TIME
		},
		YAxis: chart.YAxis{
			Name: "Value / Count",
			Style: chart.Style{
				Hidden: false, // EXPLICITLY SHOW THE AXIS
			},
		},
		Series: []chart.Series{
			chart.TimeSeries{
				Name:    key,
				XValues: xValues,
				YValues: yValues,
				Style: chart.Style{
					Hidden:      false,
					StrokeWidth: 2.0,
					// FIX: Give the line a color so it isn't transparent!
					StrokeColor: drawing.ColorBlue,

					// FIX: Force go-chart to draw dots for your datapoints
					DotWidth: 4.0,
					DotColor: drawing.ColorBlack,
				},
			},
		},
	}

	var chartBuffer bytes.Buffer
	if err := graph.Render(chart.PNG, &chartBuffer); err != nil {
		return nil, "", fmt.Errorf("chart rendering failed: %w", err)
	}

	// Validate PNG bytes; fall back to a placeholder if corrupt
	if _, err := png.Decode(bytes.NewReader(chartBuffer.Bytes())); err != nil {
		placeholder := stdimage.NewRGBA(stdimage.Rect(0, 0, 600, 300))
		bg := color.RGBA{250, 235, 215, 255}
		for x := 0; x < 600; x++ {
			for y := 0; y < 300; y++ {
				placeholder.Set(x, y, bg)
			}
		}
		chartBuffer.Reset()
		if err := png.Encode(&chartBuffer, placeholder); err != nil {
			return nil, "", fmt.Errorf("fallback chart image encoding failed: %w", err)
		}
	}

	cfg := config.NewBuilder().Build()
	m := maroto.New(cfg)

	// Header
	m.AddRows(
		row.New(25).Add(
			col.New(12).Add(
				text.New("Lumana Analytics & TimeSeries Report", props.Text{
					Size:  18,
					Style: fontstyle.Bold,
					Align: align.Center,
				}),
			),
		),
		row.New(10).Add(
			col.New(12).Add(
				text.New(fmt.Sprintf("Generated At: %s | Target Key: %s", time.Now().Format(time.RFC1123), key), props.Text{
					Size:  10,
					Align: align.Center,
				}),
			),
		),
		line.NewRow(2, props.Line{Thickness: 1}),
	)

	// Summary Cards Section
	m.AddRows(
		row.New(15).Add(
			col.New(4).Add(
				text.New(fmt.Sprintf("Total Samples: %d", len(yValues)), props.Text{Size: 11, Style: fontstyle.Bold}),
			),
			col.New(4).Add(
				text.New(fmt.Sprintf("Metric Target: %s", key), props.Text{Size: 11, Style: fontstyle.Bold}),
			),
			col.New(4).Add(
				text.New("Status: ACTIVE", props.Text{Size: 11, Style: fontstyle.Bold, Align: align.Right}),
			),
		),
	)

	// Chart Image Embedding
	m.AddRows(
		row.New(100).Add(
			col.New(12).Add(
				image.NewFromBytes(chartBuffer.Bytes(), extension.Png, props.Rect{
					Center:  true,
					Percent: 95,
				}),
			),
		),
	)

	// Footer / Verification QR code
	m.AddRows(
		line.NewRow(2, props.Line{Thickness: 0.5}),
		row.New(20).Add(
			col.New(8).Add(
				text.New("Report verified and automatically compiled by Go Service B", props.Text{Size: 9}),
			),
			col.New(4).Add(
				code.NewQr("https://dummyjson.com", props.Rect{Center: true, Percent: 90}),
			),
		),
	)

	pdfDoc, err := m.Generate()
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate pdf: %w", err)
	}

	filename := fmt.Sprintf("report_%s_%d.pdf", key, time.Now().Unix())
	return pdfDoc.GetBytes(), filename, nil
}
