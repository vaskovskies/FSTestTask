package service

import (
	"bytes"
	"context"
	"fmt"
	stdimage "image"
	"image/color"
	"image/png"
	"math"
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
	"github.com/johnfercher/maroto/v2/pkg/core"
	"github.com/johnfercher/maroto/v2/pkg/props"
	"github.com/redis/go-redis/v9"
	"github.com/wcharczuk/go-chart/v2"
	"github.com/wcharczuk/go-chart/v2/drawing"
)

type metricDef struct {
	Key         string
	Label       string
	Unit        string
	ChartName   string
	Aggregation string
}

var allMetrics = []metricDef{
	{Key: "ts:api_fetch_count", Label: "API Fetch Count", Unit: "Products", ChartName: "API Fetched Products", Aggregation: "SUM"},
	{Key: "ts:products_ingested_count", Label: "Products Ingested Count", Unit: "Products", ChartName: "Products Ingested via File Import", Aggregation: "SUM"},
	{Key: "ts:search_queries", Label: "Search Queries", Unit: "Queries", ChartName: "Search Query Count", Aggregation: "SUM"},
	{Key: "ts:search_latency_ms", Label: "Search Latency", Unit: "ms", ChartName: "Search Latency (ms)", Aggregation: "AVG"},
}

type metricData struct {
	Def     metricDef
	XValues []time.Time
	YValues []float64
	Total   float64
	Avg     float64
	Max     float64
	Min     float64
	Count   int
}

type ReportService interface {
	GenerateTimeSeriesPDFReport(ctx context.Context, startTs, endTs int64) ([]byte, string, error)
}

type reportService struct {
	rdb *redis.Client
}

func NewReportService(rdb *redis.Client) ReportService {
	return &reportService{rdb: rdb}
}

func (s *reportService) GenerateTimeSeriesPDFReport(ctx context.Context, startTs, endTs int64) ([]byte, string, error) {
	if startTs <= 0 {
		startTs = time.Now().Add(-24 * time.Hour).UnixMilli()
	}
	if endTs <= 0 {
		endTs = time.Now().UnixMilli()
	}

	filename := fmt.Sprintf("report_%d.pdf", time.Now().Unix())

	var allData []metricData
	hasData := false

	for _, m := range allMetrics {
		data := s.fetchMetricRange(ctx, m, startTs, endTs)
		if data.Count > 0 {
			hasData = true
		}
		allData = append(allData, data)
	}

	cfg := config.NewBuilder().Build()
	m := maroto.New(cfg)

	s.addHeader(m)
	s.addSummaryTable(m, allData)
	m.AddRows(line.NewRow(2, props.Line{Thickness: 0.5}))

	if !hasData {
		m.AddRows(
			row.New(60).Add(
				col.New(12).Add(
					text.New("No Data Available for any metric in the selected time range", props.Text{
						Size:  16,
						Style: fontstyle.BoldItalic,
						Align: align.Center,
						Color: &props.Color{Red: 180, Green: 180, Blue: 180},
					}),
				),
			),
		)
	} else {
		for i, data := range allData {
			if data.Count < 2 {
				s.addMetricSectionNoData(m, data.Def)
				continue
			}

			chartBytes := s.generateChart(data)
			if chartBytes == nil {
				chartBytes = s.encodePlaceholderImage()
			}

			s.addMetricSection(m, data.Def, chartBytes)
			if i < len(allData)-1 {
				m.AddRows(line.NewRow(2, props.Line{Thickness: 0.3, Color: &props.Color{Red: 200, Green: 200, Blue: 200}}))
			}
		}
	}

	s.addFooter(m)

	pdfDoc, err := m.Generate()
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate pdf: %w", err)
	}

	return pdfDoc.GetBytes(), filename, nil
}

func (s *reportService) fetchMetricRange(ctx context.Context, def metricDef, startTs, endTs int64) metricData {
	data := metricData{Def: def}

	res, err := s.rdb.Do(ctx, "TS.RANGE", def.Key, startTs, endTs, "AGGREGATION", def.Aggregation, 3600000).Result()
	if err != nil || res == nil {
		return data
	}

	rawSlice, ok := res.([]interface{})
	if !ok {
		return data
	}

	var total float64
	maxVal := -math.MaxFloat64
	minVal := math.MaxFloat64

	for _, item := range rawSlice {
		tuple, ok := item.([]interface{})
		if !ok || len(tuple) != 2 {
			continue
		}

		tsVal, _ := tuple[0].(int64)
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

		data.XValues = append(data.XValues, time.UnixMilli(tsVal))
		data.YValues = append(data.YValues, valFloat)
		total += valFloat
		if valFloat > maxVal {
			maxVal = valFloat
		}
		if valFloat < minVal {
			minVal = valFloat
		}
	}

	data.Total = total
	data.Count = len(data.YValues)
	if data.Count > 0 {
		data.Avg = total / float64(data.Count)
		data.Max = maxVal
		data.Min = minVal
	}

	return data
}

func (s *reportService) generateChart(data metricData) []byte {
	graph := chart.Chart{
		Title:  data.Def.ChartName,
		Width:  600,
		Height: 300,
		XAxis: chart.XAxis{
			Name: "Time",
			Style: chart.Style{
				Hidden: false,
			},
			ValueFormatter: chart.TimeHourValueFormatter,
		},
		YAxis: chart.YAxis{
			Name: data.Def.Unit,
			Style: chart.Style{
				Hidden: false,
			},
		},
		Series: []chart.Series{
			chart.TimeSeries{
				Name:    data.Def.Label,
				XValues: data.XValues,
				YValues: data.YValues,
				Style: chart.Style{
					Hidden:      false,
					StrokeWidth: 2.0,
					StrokeColor: drawing.ColorBlue,
					DotWidth:    4.0,
					DotColor:    drawing.ColorBlack,
				},
			},
		},
	}

	var buf bytes.Buffer
	if err := graph.Render(chart.PNG, &buf); err != nil {
		return nil
	}

	if _, err := png.Decode(bytes.NewReader(buf.Bytes())); err != nil {
		return nil
	}

	return buf.Bytes()
}

func (s *reportService) encodePlaceholderImage() []byte {
	img := stdimage.NewRGBA(stdimage.Rect(0, 0, 600, 300))
	bg := color.RGBA{250, 235, 215, 255}
	for x := 0; x < 600; x++ {
		for y := 0; y < 300; y++ {
			img.Set(x, y, bg)
		}
	}
	var buf bytes.Buffer
	png.Encode(&buf, img)
	return buf.Bytes()
}

func (s *reportService) addHeader(m core.Maroto) {
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
				text.New(fmt.Sprintf("Generated At: %s | All Metrics", time.Now().Format(time.RFC1123)), props.Text{
					Size:  10,
					Align: align.Center,
				}),
			),
		),
		line.NewRow(2, props.Line{Thickness: 1}),
	)
}

func (s *reportService) addSummaryTable(m core.Maroto, allData []metricData) {
	m.AddRows(
		row.New(12).Add(
			col.New(12).Add(
				text.New("Metrics Summary", props.Text{Size: 14, Style: fontstyle.Bold, Align: align.Left}),
			),
		),
		row.New(10).Add(
			col.New(3).Add(text.New("Metric", props.Text{Size: 9, Style: fontstyle.Bold})),
			col.New(2).Add(text.New("Samples", props.Text{Size: 9, Style: fontstyle.Bold, Align: align.Center})),
			col.New(2).Add(text.New("Total", props.Text{Size: 9, Style: fontstyle.Bold, Align: align.Center})),
			col.New(2).Add(text.New("Avg", props.Text{Size: 9, Style: fontstyle.Bold, Align: align.Center})),
			col.New(1).Add(text.New("Max", props.Text{Size: 9, Style: fontstyle.Bold, Align: align.Center})),
			col.New(2).Add(text.New("Min", props.Text{Size: 9, Style: fontstyle.Bold, Align: align.Center})),
		),
	)
	m.AddRows(line.NewRow(1, props.Line{Thickness: 0.5}))

	for _, data := range allData {
		samples := fmt.Sprintf("%d", data.Count)
		total := fmt.Sprintf("%.1f", data.Total)
		avg := fmt.Sprintf("%.2f", data.Avg)
		maxStr := fmt.Sprintf("%.1f", data.Max)
		minStr := fmt.Sprintf("%.1f", data.Min)
		if data.Count == 0 {
			samples = "0"
			total = "-"
			avg = "-"
			maxStr = "-"
			minStr = "-"
		}

		m.AddRows(
			row.New(8).Add(
				col.New(3).Add(text.New(data.Def.Label, props.Text{Size: 8})),
				col.New(2).Add(text.New(samples, props.Text{Size: 8, Align: align.Center})),
				col.New(2).Add(text.New(total, props.Text{Size: 8, Align: align.Center})),
				col.New(2).Add(text.New(avg, props.Text{Size: 8, Align: align.Center})),
				col.New(1).Add(text.New(maxStr, props.Text{Size: 8, Align: align.Center})),
				col.New(2).Add(text.New(minStr, props.Text{Size: 8, Align: align.Center})),
			),
		)
	}

	m.AddRows(line.NewRow(2, props.Line{Thickness: 0.5}))
}

func (s *reportService) addMetricSection(m core.Maroto, def metricDef, chartBytes []byte) {
	m.AddRows(
		row.New(15).Add(
			col.New(12).Add(
				text.New(fmt.Sprintf("Metric: %s (%s)", def.Label, def.Key), props.Text{
					Size:  13,
					Style: fontstyle.Bold,
				}),
			),
		),
		row.New(100).Add(
			col.New(12).Add(
				image.NewFromBytes(chartBytes, extension.Png, props.Rect{
					Center:  true,
					Percent: 95,
				}),
			),
		),
	)
}

func (s *reportService) addMetricSectionNoData(m core.Maroto, def metricDef) {
	m.AddRows(
		row.New(15).Add(
			col.New(12).Add(
				text.New(fmt.Sprintf("Metric: %s (%s)", def.Label, def.Key), props.Text{
					Size:  13,
					Style: fontstyle.Bold,
				}),
			),
		),
		row.New(60).Add(
			col.New(12).Add(
				text.New("No Data Available for this metric in the selected time range", props.Text{
					Size:  14,
					Style: fontstyle.BoldItalic,
					Align: align.Center,
					Color: &props.Color{Red: 180, Green: 180, Blue: 180},
				}),
			),
		),
	)
}

func (s *reportService) addFooter(m core.Maroto) {
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
}
