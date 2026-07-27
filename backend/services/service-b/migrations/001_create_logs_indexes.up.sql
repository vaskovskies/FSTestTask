[
  {
    "createIndexes": "logs",
    "indexes": [
      {
        "key": {"service": 1, "action": 1, "timestamp": -1},
        "name": "idx_logs_service_action_ts"
      },
      {
        "key": {"timestamp": -1},
        "name": "idx_logs_timestamp"
      },
      {
        "key": {"action": 1},
        "name": "idx_logs_action"
      }
    ]
  }
]
