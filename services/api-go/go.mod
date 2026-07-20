module github.com/houstonwilson71-alt/sniper111/api

go 1.23

require (
	github.com/gin-contrib/cors v1.7.3
	github.com/gin-gonic/gin v1.10.0
	github.com/go-playground/validator/v10 v10.23.0
	github.com/gorilla/websocket v1.5.3
	github.com/jackc/pgx/v5 v5.7.1
	github.com/nats-io/nats.go v1.37.0
	github.com/redis/go-redis/v9 v9.7.0
	github.com/houstonwilson71-alt/sniper111/common/proto/engine v0.0.0
	google.golang.org/grpc v1.69.2
)

replace github.com/houstonwilson71-alt/sniper111/common/proto/engine => ../../common/proto/engine

require (
	google.golang.org/protobuf v1.36.1 // indirect
	golang.org/x/net v0.33.0 // indirect
	golang.org/x/sys v0.28.0 // indirect
	golang.org/x/text v0.21.0 // indirect
)
