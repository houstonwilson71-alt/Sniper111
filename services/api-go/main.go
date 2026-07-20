// services/api-go/main.go
// Go backend that serves the Next.js dashboard and bridges commands/events to the Rust engine via gRPC.
package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}

	db := mustInitDB()
	defer db.Close()

	pubsub := mustInitPubSub()
	defer pubsub.Close()

	wss := newWebSocketHub()
	go wss.run()

	// Fan out pub/sub events to WebSocket clients.
	go pubsub.subscribe(func(channel string, payload []byte) {
		wss.broadcastMsg(payload)
	})

	// Bidirectional gRPC connection to the Rust engine.
	bridge := mustInitEngineBridge(wss, db)

	r := gin.Default()
	r.Use(cors.Default())

	api := r.Group("/api")
	attachRoutes(api, db, pubsub, wss, bridge)

	// WebSocket upgrade endpoint.
	r.GET("/api/ws", wss.handle)

	// Serve static Next.js build when running outside Replit.
	r.Static("/", "/app/dist")

	log.Printf("API server listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
