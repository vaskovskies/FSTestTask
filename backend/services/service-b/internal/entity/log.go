package entity

import "time"

type Log struct {
	ID        string
	Service   string
	Action    string
	Payload   string
	Level     string
	Timestamp time.Time
}

type LogFilter struct {
	Service   string
	Action    string
	Level     string
	StartDate *time.Time
	EndDate   *time.Time
	Page      int
	Limit     int
}
