// services/api-go/routes.go
// HTTP route handlers mirroring the Node API contract.
package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/houstonwilson71-alt/sniper111/common/proto/engine"
)

type startStopRequest struct {
	Reason string `json:"reason,omitempty"`
}

func attachRoutes(r *gin.RouterGroup, db *DB, pubsub PubSub, wss *webSocketHub, bridge *engineBridge) {
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	r.GET("/config", func(c *gin.Context) {
		cfg, err := db.GetConfig()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, cfg)
	})

	r.PUT("/config", func(c *gin.Context) {
		var cfg BotConfig
		if err := c.ShouldBindJSON(&cfg); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		updated, err := db.UpdateConfig(cfg)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		bridge.sendConfig(*updated)
		pubsub.publish("bot:config", updated)
		c.JSON(http.StatusOK, updated)
	})

	r.GET("/bot/status", func(c *gin.Context) {
		st, err := db.GetState()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, st)
	})

	r.POST("/bot/start", func(c *gin.Context) {
		st, err := db.SetRunning(true)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		bridge.sendControl(engine.ControlCommand_START, "")
		pubsub.publish("bot:state", st)
		c.JSON(http.StatusOK, st)
	})

	r.POST("/bot/stop", func(c *gin.Context) {
		st, err := db.SetRunning(false)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		bridge.sendControl(engine.ControlCommand_STOP, "")
		pubsub.publish("bot:state", st)
		c.JSON(http.StatusOK, st)
	})

	r.POST("/bot/emergency-stop", func(c *gin.Context) {
		var req startStopRequest
		_ = c.ShouldBindJSON(&req)
		st, err := db.SetEmergencyStop(true, req.Reason)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		bridge.sendControl(engine.ControlCommand_EMERGENCY_STOP, req.Reason)
		pubsub.publish("bot:state", st)
		c.JSON(http.StatusOK, st)
	})

	r.POST("/bot/reset-emergency", func(c *gin.Context) {
		st, err := db.SetEmergencyStop(false, "")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		bridge.sendControl(engine.ControlCommand_RESET_EMERGENCY, "")
		pubsub.publish("bot:state", st)
		c.JSON(http.StatusOK, st)
	})

	r.GET("/wallet", func(c *gin.Context) {
		w, err := db.GetWallet()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, w.Public())
	})

	r.PUT("/wallet", func(c *gin.Context) {
		var w WalletConfig
		if err := c.ShouldBindJSON(&w); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		updated, err := db.UpdateWallet(w)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, updated.Public())
	})

	r.GET("/tokens", func(c *gin.Context) {
		items, err := db.GetTokens()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	})

	r.GET("/trades", func(c *gin.Context) {
		items, err := db.GetTrades()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	})

	r.GET("/positions", func(c *gin.Context) {
		items, err := db.GetPositions()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	})

	r.GET("/performance/summary", func(c *gin.Context) {
		summary, err := db.GetPerformanceSummary()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"summary": summary})
	})

	r.GET("/performance/equity", func(c *gin.Context) {
		items, err := db.GetEquity()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	})
}
